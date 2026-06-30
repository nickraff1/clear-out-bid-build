// Stripe webhook for built-in (manual_payout_mode) payments.
// Subscribed events include checkout.session.completed and payment_intent.payment_failed.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";
import { completePaidOrder, ORDER_CONFIRMED_MESSAGE } from "../_shared/paid-order.ts";

let _supabase: ReturnType<typeof createClient> | null = null;

type CheckoutSession = {
  id: string;
  metadata?: { order_id?: string | null } | null;
  payment_intent?: string | null;
};

type PaymentIntent = {
  id: string;
  last_payment_error?: { message?: string | null } | null;
};

type PaymentRow = { id: string; order_id?: string | null; status?: string | null };

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

async function handleSessionCompleted(session: CheckoutSession, env: StripeEnv) {
  const orderId = session.metadata?.order_id;
  if (!orderId) {
    console.log("session.completed without order_id metadata; ignoring");
    return;
  }
  const sb = getSupabase();

  await sb.from("payments").update({
    status: "succeeded",
    stripe_payment_intent_id: session.payment_intent ?? null,
    environment: env,
    updated_at: new Date().toISOString(),
  }).eq("stripe_session_id", session.id);

  await completePaidOrder(sb, {
    orderId,
    paymentReference: session.payment_intent ?? session.id,
  });
}

async function handlePaymentFailed(pi: PaymentIntent, env: StripeEnv) {
  await getSupabase().from("payments").update({
    status: "failed",
    error_message: pi.last_payment_error?.message ?? "Payment failed",
    environment: env,
    updated_at: new Date().toISOString(),
  }).eq("stripe_payment_intent_id", pi.id);
}

// Cancel the pending order tied to a session/payment-intent, but ONLY if it is
// still pending_payment and no successful payment exists. This is the defensive
// check that prevents accidentally releasing a lot that has already been paid.
async function cancelPendingOrderForSession(args: { sessionId?: string; paymentIntentId?: string }, env: StripeEnv) {
  const sb = getSupabase();
  const { sessionId, paymentIntentId } = args;

  // Locate the payment row (we stamp it on checkout creation).
  let paymentQuery = sb.from("payments").select("id, order_id, status").limit(1);
  if (sessionId) paymentQuery = paymentQuery.eq("stripe_session_id", sessionId);
  else if (paymentIntentId) paymentQuery = paymentQuery.eq("stripe_payment_intent_id", paymentIntentId);
  else return;
  const { data: paymentData } = await paymentQuery.maybeSingle();
  const payment = paymentData as unknown as PaymentRow | null;
  if (!payment) return;

  // Mark the payment cancelled (don't clobber a succeeded one).
  if (payment.status !== "succeeded") {
    await sb.from("payments").update({
        status: "cancelled",
      environment: env,
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);
  }

  const orderId = payment.order_id as string | undefined;
  if (!orderId) return;

  // Defensive: only cancel the order if it is still pending_payment AND no
  // succeeded payment exists for it. The order_cancel trigger will release
  // the lot back to active automatically.
  const { data: succeeded } = await sb.from("payments")
    .select("id").eq("order_id", orderId).eq("status", "succeeded").limit(1).maybeSingle();
  if (succeeded) {
    console.log(`[webhook] order ${orderId} already has succeeded payment; not cancelling`);
    return;
  }

  await sb.from("orders").update({
    status: "cancelled",
    updated_at: new Date().toISOString(),
  }).eq("id", orderId).eq("status", "pending_payment");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Webhook missing/invalid env:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
  const env: StripeEnv = rawEnv;

  try {
    const event = await verifyWebhook(req, env);
    const eventId = event.id ?? `${event.type}:${crypto.randomUUID()}`;
    const sb = getSupabase();

    const { error: ledgerInsertError } = await sb.from("stripe_webhook_events").insert({
      event_id: eventId,
      event_type: event.type,
      environment: env,
      processing_status: "processing",
      payload: event as unknown as Record<string, unknown>,
    });

    if (ledgerInsertError) {
      if (ledgerInsertError.code === "23505") {
        console.log("Duplicate webhook event ignored:", eventId);
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
      throw ledgerInsertError;
    }

    const eventObject = event.data.object;
    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleSessionCompleted(eventObject as CheckoutSession, env);
          break;
        case "payment_intent.payment_failed":
          await handlePaymentFailed(eventObject as PaymentIntent, env);
          await cancelPendingOrderForSession({ paymentIntentId: (eventObject as PaymentIntent).id }, env);
          break;
        case "checkout.session.expired":
        case "checkout.session.async_payment_failed":
          await cancelPendingOrderForSession({ sessionId: (eventObject as CheckoutSession).id }, env);
          break;
        case "payment_intent.canceled":
          await cancelPendingOrderForSession({ paymentIntentId: (eventObject as PaymentIntent).id }, env);
          break;
        default:
          console.log("Unhandled event:", event.type);
      }
      await sb.from("stripe_webhook_events").update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
      }).eq("event_id", eventId);
    } catch (eventError) {
      await sb.from("stripe_webhook_events").update({
        processing_status: "failed",
        error_message: (eventError as Error).message,
        processed_at: new Date().toISOString(),
      }).eq("event_id", eventId);
      throw eventError;
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
