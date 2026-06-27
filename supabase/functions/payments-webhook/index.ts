// Stripe webhook for built-in (manual_payout_mode) payments.
// Subscribed events include checkout.session.completed and payment_intent.payment_failed.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
const ORDER_CONFIRMED_MESSAGE =
  "Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed.";

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

async function handleSessionCompleted(session: any, env: StripeEnv) {
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

  // Move order from pending_payment to paid, generate pickup code
  // Use postgres RPC to get a pickup code
  const { data: codeRow } = await sb.rpc("generate_pickup_code");
  const pickupCode = (codeRow as unknown as string) ?? Math.random().toString(36).slice(2, 8).toUpperCase();

  const { data: updatedOrder } = await sb.from("orders").update({
    status: "paid",
    payment_reference: session.payment_intent ?? session.id,
    pickup_code: pickupCode,
    pickup_status: "awaiting_arrangement",
    updated_at: new Date().toISOString(),
  }).eq("id", orderId).eq("status", "pending_payment").select("*, lot:lots(id, title, event_id), event:clearance_events(org_id, created_by)").maybeSingle();

  if (!updatedOrder) return;

  // Mark the lot as sold
  await sb.from("lots").update({
    status: "sold",
    reserved_until: null,
  }).eq("id", (updatedOrder as any).lot_id);

  // Create or reuse the conversation between buyer and seller org for this lot.
  const buyerId = (updatedOrder as any).buyer_id as string;
  const lotId = (updatedOrder as any).lot_id as string;
  const sellerOrgId = (updatedOrder as any).event?.org_id as string | undefined;
  let conversationId: string | null = null;

  if (sellerOrgId) {
    const { data: conversation, error: conversationError } = await sb
      .from("conversations")
      .upsert(
        { buyer_id: buyerId, seller_org_id: sellerOrgId, lot_id: lotId, order_id: orderId },
        { onConflict: "buyer_id,seller_org_id,lot_id" },
      )
      .select("id")
      .single();

    if (conversationError) {
      console.error("Failed to create order conversation", conversationError);
    } else {
      conversationId = (conversation as any)?.id ?? null;
    }

    if (conversationId) {
      const { data: existingSystemMessage } = await sb
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("is_system", true)
        .eq("body", ORDER_CONFIRMED_MESSAGE)
        .maybeSingle();

      if (!existingSystemMessage) {
        await sb.from("messages").insert({
          conversation_id: conversationId,
          sender_id: buyerId,
          is_system: true,
          body: ORDER_CONFIRMED_MESSAGE,
        });
      }
    }
  }

  // Notifications
  const sellerCreator = (updatedOrder as any).event?.created_by as string | undefined;
  const lotTitle = (updatedOrder as any).lot?.title ?? "your lot";
  const notifications: any[] = [
    {
      user_id: buyerId,
      type: "order_paid",
      title: "Payment received",
      message: `Your payment for "${lotTitle}" was successful. The seller has been notified — arrange pickup from your order page.`,
      data: { order_id: orderId },
    },
  ];
  if (sellerCreator) {
    notifications.push({
      user_id: sellerCreator,
      type: "order_sold",
      title: "Item sold",
      message: `"${lotTitle}" has been paid for. Arrange pickup with the buyer and mark it ready when prepared.`,
      data: { order_id: orderId },
    });
  }
  await sb.from("notifications").insert(notifications);
}

async function handlePaymentFailed(pi: any, env: StripeEnv) {
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
  const { data: payment } = await paymentQuery.maybeSingle();
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
    switch (event.type) {
      case "checkout.session.completed":
        await handleSessionCompleted(event.data.object, env);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object, env);
        await cancelPendingOrderForSession({ paymentIntentId: event.data.object?.id }, env);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await cancelPendingOrderForSession({ sessionId: event.data.object?.id }, env);
        break;
      case "payment_intent.canceled":
        await cancelPendingOrderForSession({ paymentIntentId: event.data.object?.id }, env);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
