// Stripe webhook for built-in (manual_payout_mode) payments.
// Subscribed events include checkout.session.completed and direct PaymentIntent
// events from auction winner off-session charges.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";
import { completePaidOrder, ORDER_CONFIRMED_MESSAGE } from "../_shared/paid-order.ts";
import { summarizeConnectAccount } from "../_shared/connect-status.ts";

let _supabase: ReturnType<typeof createClient> | null = null;

type CheckoutSession = {
  id: string;
  metadata?: { order_id?: string | null } | null;
  payment_intent?: string | null;
};

type PaymentIntent = {
  id: string;
  amount_received?: number | null;
  amount?: number | null;
  metadata?: {
    order_id?: string | null;
    base_amount?: string | null;
    buyer_fee?: string | null;
    seller_fee?: string | null;
    seller_payout?: string | null;
    source?: string | null;
  } | null;
  last_payment_error?: { message?: string | null } | null;
};

type PaymentRow = { id: string; order_id?: string | null; status?: string | null };

type StripeAccountEvent = {
  id: string;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  capabilities?: { card_payments?: string | null; transfers?: string | null } | null;
  requirements?: {
    currently_due?: string[] | null;
    past_due?: string[] | null;
    eventually_due?: string[] | null;
    pending_verification?: string[] | null;
    disabled_reason?: string | null;
  } | null;
  future_requirements?: {
    currently_due?: string[] | null;
    past_due?: string[] | null;
    eventually_due?: string[] | null;
  } | null;
};

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

async function handlePaymentSucceeded(pi: PaymentIntent, env: StripeEnv) {
  const sb = getSupabase();
  const metadataOrderId = pi.metadata?.order_id ?? null;

  const { data: existingPayment } = await sb
    .from("payments")
    .select("id, order_id, status")
    .eq("stripe_payment_intent_id", pi.id)
    .maybeSingle();
  const payment = existingPayment as unknown as PaymentRow | null;
  const orderId = payment?.order_id ?? metadataOrderId;

  if (!orderId) {
    console.log("payment_intent.succeeded without order_id; ignoring", pi.id);
    return;
  }

  if (payment?.id) {
    await sb.from("payments").update({
      status: "succeeded",
      stripe_payment_intent_id: pi.id,
      payment_method: "card",
      environment: env,
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);
  } else {
    const total = Number(((pi.amount_received ?? pi.amount ?? 0) / 100).toFixed(2));
    const baseAmount = Number(pi.metadata?.base_amount ?? (total / 1.10).toFixed(2));
    const buyerFee = Number(pi.metadata?.buyer_fee ?? (total - baseAmount).toFixed(2));
    const sellerFee = Number(pi.metadata?.seller_fee ?? (baseAmount * 0.10).toFixed(2));
    const sellerPayout = Number(pi.metadata?.seller_payout ?? (baseAmount - sellerFee).toFixed(2));

    await sb.from("payments").insert({
      order_id: orderId,
      base_amount: baseAmount,
      buyer_fee: buyerFee,
      seller_fee: sellerFee,
      seller_payout: sellerPayout,
      amount_charged: total,
      application_fee_amount: buyerFee + sellerFee,
      status: "succeeded",
      stripe_payment_intent_id: pi.id,
      payment_method: "card",
      payment_mode: "manual_payout_mode",
      manual_payout_status: "manual_payout_pending",
      environment: env,
      updated_at: new Date().toISOString(),
    });
  }

  await completePaidOrder(sb, {
    orderId,
    paymentReference: pi.id,
  });
}

// Connect: keep seller_stripe_accounts in sync with Stripe.
async function handleAccountUpdated(acct: StripeAccountEvent, env: StripeEnv) {
  await getSupabase().from("seller_stripe_accounts").update({
    ...summarizeConnectAccount(acct),
    stripe_environment: env,
  }).eq("stripe_account_id", acct.id);
}

async function refreshConnectedAccount(accountId: string | null | undefined, env: StripeEnv) {
  if (!accountId) return;
  const stripe = createStripeClient(env);
  const account = await stripe.accounts.retrieve(accountId);
  await handleAccountUpdated(account as StripeAccountEvent, env);
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
        case "payment_intent.succeeded":
          await handlePaymentSucceeded(eventObject as PaymentIntent, env);
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
        case "account.updated":
          await handleAccountUpdated(eventObject as StripeAccountEvent, env);
          break;
        case "capability.updated":
        case "person.updated":
        case "account.external_account.created":
        case "account.external_account.updated":
        case "account.external_account.deleted":
          await refreshConnectedAccount((eventObject as { account?: string | null }).account, env);
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
