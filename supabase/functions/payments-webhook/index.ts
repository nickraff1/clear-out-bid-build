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
  payment_intent?: string | { id: string } | null;
};

type PaymentIntent = {
  id: string;
  amount_received?: number | null;
  amount?: number | null;
  currency?: string | null;
  latest_charge?: string | { id: string } | null;
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

type Charge = {
  id: string;
  amount: number;
  currency: string;
  paid?: boolean | null;
  status?: string | null;
  payment_intent?: string | { id: string } | null;
  balance_transaction?: string | {
    id: string;
    status?: string | null;
    available_on?: number | null;
  } | null;
};

type ChargeDetails = {
  chargeId: string;
  amount: number;
  currency: string;
  balanceTransactionId: string | null;
  settlementStatus: "unknown" | "pending" | "available";
  availableOn: string | null;
};

type PaymentRow = { id: string; order_id?: string | null; status?: string | null };

type ReconciliationPayment = {
  id: string;
  order_id: string;
  environment: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_balance_transaction_id: string | null;
  amount_charged: number;
  base_amount: number;
  buyer_fee: number;
  seller_fee: number;
  seller_payout: number;
  buyer_fee_tax_amount: number | null;
  seller_fee_tax_amount: number | null;
  tax_calculation_status: string | null;
  order: { event: { org_id: string } | null } | null;
};

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

const stripeId = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : value?.id ?? null;

async function resolveChargeDetails(pi: PaymentIntent, env: StripeEnv): Promise<ChargeDetails | null> {
  const stripe = createStripeClient(env);
  let chargeId = stripeId(pi.latest_charge);
  if (!chargeId) {
    const retrieved = await stripe.paymentIntents.retrieve(pi.id, {
      expand: ["latest_charge.balance_transaction"],
    });
    chargeId = stripeId(retrieved.latest_charge as string | { id: string } | null);
  }
  if (!chargeId) return null;

  const charge = await stripe.charges.retrieve(chargeId, {
    expand: ["balance_transaction"],
  }) as unknown as Charge;
  const balance = typeof charge.balance_transaction === "string"
    ? null
    : charge.balance_transaction;
  const balanceTransactionId = typeof charge.balance_transaction === "string"
    ? charge.balance_transaction
    : charge.balance_transaction?.id ?? null;
  const settlementStatus: ChargeDetails["settlementStatus"] = balance?.status === "available"
    ? "available"
    : balance?.status === "pending"
    ? "pending"
    : "unknown";

  return {
    chargeId: charge.id,
    amount: charge.amount / 100,
    currency: charge.currency.toLowerCase(),
    balanceTransactionId,
    settlementStatus,
    availableOn: balance?.available_on
      ? new Date(balance.available_on * 1000).toISOString()
      : null,
  };
}

const chargeUpdate = (charge: ChargeDetails | null) => charge ? {
  stripe_charge_id: charge.chargeId,
  stripe_charge_amount: charge.amount,
  stripe_charge_currency: charge.currency,
  stripe_balance_transaction_id: charge.balanceTransactionId,
  stripe_charge_available_on: charge.availableOn,
  stripe_charge_settlement_status: charge.settlementStatus,
} : {};

async function recordChargeReconciliation(paymentId: string) {
  const sb = getSupabase();
  const { data } = await sb.from("payments").select(`
    id, order_id, environment, stripe_payment_intent_id, stripe_charge_id,
    stripe_balance_transaction_id, amount_charged, base_amount, buyer_fee,
    seller_fee, seller_payout, buyer_fee_tax_amount, seller_fee_tax_amount,
    tax_calculation_status,
    order:orders!payments_order_id_fkey(event:clearance_events(org_id))
  `).eq("id", paymentId).maybeSingle();
  const payment = data as unknown as ReconciliationPayment | null;
  if (!payment?.stripe_charge_id) return;
  const { error } = await sb.from("payment_transfer_reconciliation").insert({
    payment_id: payment.id,
    order_id: payment.order_id,
    seller_org_id: payment.order?.event?.org_id ?? null,
    event_type: "charge_recorded",
    outcome: "recorded",
    environment: payment.environment === "live" ? "live" : "sandbox",
    stripe_payment_intent_id: payment.stripe_payment_intent_id,
    stripe_charge_id: payment.stripe_charge_id,
    stripe_balance_transaction_id: payment.stripe_balance_transaction_id,
    currency: "aud",
    buyer_charge_amount: payment.amount_charged,
    base_amount: payment.base_amount,
    buyer_fee: payment.buyer_fee,
    seller_fee: payment.seller_fee,
    seller_payout: payment.seller_payout,
    buyer_fee_tax_amount: payment.buyer_fee_tax_amount,
    seller_fee_tax_amount: payment.seller_fee_tax_amount,
    tax_calculation_status: payment.tax_calculation_status ?? "not_configured",
    metadata: { source: "payments-webhook" },
  });
  if (error) console.error("Could not record charge reconciliation", error.message);
}

async function handleSessionCompleted(session: CheckoutSession, env: StripeEnv) {
  const orderId = session.metadata?.order_id;
  if (!orderId) {
    console.log("session.completed without order_id metadata; ignoring");
    return;
  }
  const sb = getSupabase();
  const paymentIntentId = stripeId(session.payment_intent);
  let charge: ChargeDetails | null = null;
  if (paymentIntentId) {
    const stripe = createStripeClient(env);
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    charge = await resolveChargeDetails(intent as unknown as PaymentIntent, env);
  }

  const { data: updatedPayment } = await sb.from("payments").update({
    status: "succeeded",
    stripe_payment_intent_id: paymentIntentId,
    ...chargeUpdate(charge),
    environment: env,
    updated_at: new Date().toISOString(),
  }).eq("stripe_session_id", session.id).select("id").maybeSingle();

  if (updatedPayment?.id) await recordChargeReconciliation(updatedPayment.id);

  await completePaidOrder(sb, {
    orderId,
    paymentReference: paymentIntentId ?? session.id,
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
  const charge = await resolveChargeDetails(pi, env);

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
      ...chargeUpdate(charge),
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
      ...chargeUpdate(charge),
      payment_method: "card",
      payment_mode: "manual_payout_mode",
      manual_payout_status: "manual_payout_pending",
      environment: env,
      updated_at: new Date().toISOString(),
    }).select("id").single();
  }

  const { data: reconciledPayment } = await sb.from("payments")
    .select("id").eq("stripe_payment_intent_id", pi.id).maybeSingle();
  if (reconciledPayment?.id) await recordChargeReconciliation(reconciledPayment.id);

  await completePaidOrder(sb, {
    orderId,
    paymentReference: pi.id,
  });
}

async function handleChargeSucceeded(charge: Charge, env: StripeEnv) {
  const paymentIntentId = stripeId(charge.payment_intent);
  if (!paymentIntentId) return;
  const balance = typeof charge.balance_transaction === "string" ? null : charge.balance_transaction;
  const details: ChargeDetails = {
    chargeId: charge.id,
    amount: charge.amount / 100,
    currency: charge.currency.toLowerCase(),
    balanceTransactionId: typeof charge.balance_transaction === "string"
      ? charge.balance_transaction
      : charge.balance_transaction?.id ?? null,
    settlementStatus: balance?.status === "available"
      ? "available"
      : balance?.status === "pending"
      ? "pending"
      : "unknown",
    availableOn: balance?.available_on
      ? new Date(balance.available_on * 1000).toISOString()
      : null,
  };
  const { data } = await getSupabase().from("payments").update({
    ...chargeUpdate(details),
    environment: env,
    updated_at: new Date().toISOString(),
  }).eq("stripe_payment_intent_id", paymentIntentId).select("id").maybeSingle();
  if (data?.id) await recordChargeReconciliation(data.id);
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
        case "charge.succeeded":
          await handleChargeSucceeded(eventObject as Charge, env);
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
