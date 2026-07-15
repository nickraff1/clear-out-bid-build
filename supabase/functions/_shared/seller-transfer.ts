// Shared helper for separate charges and transfers. New payments use the
// originating Stripe Charge as source_transaction; legacy rows without a
// recoverable Charge retain the previous platform-balance retry path.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv, assertLivePaymentsEnabled } from "./stripe.ts";
import { explainConnectBlock } from "./connect-status.ts";

type Admin = ReturnType<typeof createClient>;

export type TransferOutcome =
  | { ok: true; transfer_id: string; awaiting_settlement: boolean; source_transaction_used: boolean }
  | { ok: false; skipped: string; transfer_id?: string }
  | { ok: false; error: string; error_code?: string };

type PaymentRow = {
  id: string;
  order_id: string;
  status: string;
  base_amount: number | string;
  buyer_fee: number | string;
  seller_fee: number | string;
  seller_payout: number | string;
  amount_charged: number | string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  manual_payout_status: string;
  environment: string | null;
  payout_attempt_count: number | null;
  buyer_fee_tax_amount: number | string | null;
  seller_fee_tax_amount: number | string | null;
  tax_calculation_status: string | null;
  order: {
    status: string;
    lot: { event: { org_id: string } | null } | null;
  } | null;
};

type SellerAccount = {
  stripe_account_id: string | null;
  payouts_enabled: boolean | null;
  capability_transfers: string | null;
  connect_readiness_status: string | null;
  disabled_reason: string | null;
  requirements_currently_due: string[] | null;
  requirements_past_due: string[] | null;
};

type ChargeDetails = {
  id: string;
  amountCents: number;
  currency: string;
  balanceTransactionId: string | null;
  settlementStatus: "unknown" | "pending" | "available";
  availableOn: string | null;
};

type SettingsRow = { auto_payouts_enabled: boolean | null };

const toMoney = (value: number | string | null | undefined) => Number(value ?? 0);
const toCents = (value: number | string | null | undefined) => Math.round(toMoney(value) * 100);

function stripeError(err: unknown) {
  const candidate = err as { code?: string; message?: string; raw?: { code?: string; message?: string } };
  return {
    code: candidate.code ?? candidate.raw?.code ?? "stripe_transfer_failed",
    message: candidate.message ?? candidate.raw?.message ?? "Stripe transfer failed",
  };
}

async function recordReconciliation(
  admin: Admin,
  payment: PaymentRow,
  sellerOrgId: string,
  values: Record<string, unknown>,
) {
  const { error } = await admin.from("payment_transfer_reconciliation").insert({
    payment_id: payment.id,
    order_id: payment.order_id,
    seller_org_id: sellerOrgId,
    attempt_number: (payment.payout_attempt_count ?? 0) + 1,
    environment: payment.environment === "live" ? "live" : "sandbox",
    stripe_payment_intent_id: payment.stripe_payment_intent_id,
    stripe_charge_id: payment.stripe_charge_id,
    buyer_charge_amount: toMoney(payment.amount_charged),
    base_amount: toMoney(payment.base_amount),
    buyer_fee: toMoney(payment.buyer_fee),
    seller_fee: toMoney(payment.seller_fee),
    seller_payout: toMoney(payment.seller_payout),
    buyer_fee_tax_amount: payment.buyer_fee_tax_amount,
    seller_fee_tax_amount: payment.seller_fee_tax_amount,
    tax_calculation_status: payment.tax_calculation_status ?? "not_configured",
    ...values,
  });
  if (error) console.error("Could not write payout reconciliation event", error.message);
}

async function resolveChargeDetails(
  admin: Admin,
  stripe: ReturnType<typeof createStripeClient>,
  payment: PaymentRow,
): Promise<ChargeDetails | null> {
  let chargeId = payment.stripe_charge_id;

  if (!chargeId && payment.stripe_payment_intent_id) {
    const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, {
      expand: ["latest_charge.balance_transaction"],
    });
    chargeId = typeof intent.latest_charge === "string"
      ? intent.latest_charge
      : intent.latest_charge?.id ?? null;
    if (!chargeId) {
      throw new Error(
        `Succeeded PaymentIntent ${payment.stripe_payment_intent_id} has no source Charge`,
      );
    }
  }

  // Only genuinely legacy payments without either Stripe identifier keep the
  // old balance-based retry path. A known PaymentIntent is never silently
  // downgraded when its source Charge is missing or cannot be retrieved.
  if (!chargeId) return null;

  const charge = await stripe.charges.retrieve(chargeId, {
    expand: ["balance_transaction"],
  });
  if (!charge.paid || charge.status !== "succeeded") {
    throw new Error(`Source charge ${charge.id} is not succeeded`);
  }

  const balanceTransaction = typeof charge.balance_transaction === "string"
    ? null
    : charge.balance_transaction;
  const balanceTransactionId = typeof charge.balance_transaction === "string"
    ? charge.balance_transaction
    : charge.balance_transaction?.id ?? null;
  const rawStatus = balanceTransaction?.status;
  const settlementStatus: ChargeDetails["settlementStatus"] = rawStatus === "available"
    ? "available"
    : rawStatus === "pending"
    ? "pending"
    : "unknown";
  const availableOn = balanceTransaction?.available_on
    ? new Date(balanceTransaction.available_on * 1000).toISOString()
    : null;

  const details: ChargeDetails = {
    id: charge.id,
    amountCents: charge.amount,
    currency: charge.currency.toLowerCase(),
    balanceTransactionId,
    settlementStatus,
    availableOn,
  };

  const { error } = await admin.from("payments").update({
    stripe_charge_id: details.id,
    stripe_charge_amount: details.amountCents / 100,
    stripe_charge_currency: details.currency,
    stripe_balance_transaction_id: details.balanceTransactionId,
    stripe_charge_available_on: details.availableOn,
    stripe_charge_settlement_status: details.settlementStatus,
    updated_at: new Date().toISOString(),
  }).eq("id", payment.id);
  if (error) throw new Error(`Could not persist source charge: ${error.message}`);

  payment.stripe_charge_id = details.id;
  return details;
}

export async function isAutoPayoutsEnabled(admin: Admin): Promise<boolean> {
  const { data } = await admin
    .from("auction_deposit_settings")
    .select("auto_payouts_enabled")
    .eq("singleton", true)
    .maybeSingle();
  return (data as SettingsRow | null)?.auto_payouts_enabled !== false;
}

export async function transferSellerPayout(
  admin: Admin,
  paymentId: string,
  note: string,
): Promise<TransferOutcome> {
  const { data: paymentData, error: paymentError } = await admin
    .from("payments")
    .select(`
      id, order_id, status, base_amount, buyer_fee, seller_fee, seller_payout,
      amount_charged, stripe_payment_intent_id, stripe_charge_id,
      stripe_transfer_id, manual_payout_status, environment,
      payout_attempt_count, buyer_fee_tax_amount, seller_fee_tax_amount,
      tax_calculation_status,
      order:orders!payments_order_id_fkey(
        status,
        lot:lots(event:clearance_events(org_id))
      )
    `)
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError) return { ok: false, error: paymentError.message };
  const payment = paymentData as unknown as PaymentRow | null;
  if (!payment) return { ok: false, error: "Payment not found" };
  if (payment.status !== "succeeded") {
    return { ok: false, error: `Cannot transfer payout: payment is ${payment.status}` };
  }
  if (payment.stripe_transfer_id) {
    return { ok: false, skipped: "already_transferred", transfer_id: payment.stripe_transfer_id };
  }
  if (payment.manual_payout_status === "manual_payout_on_hold") {
    return { ok: false, skipped: "payout_on_hold" };
  }
  if (payment.order?.status !== "collected") {
    return { ok: false, error: "Order must be collected before seller transfer" };
  }

  const payoutCents = toCents(payment.seller_payout);
  if (!Number.isSafeInteger(payoutCents) || payoutCents <= 0) {
    return { ok: false, error: "Seller payout must be greater than zero" };
  }

  const { data: openIssue } = await admin
    .from("lot_reports")
    .select("id")
    .eq("order_id", payment.order_id)
    .in("status", ["open", "investigating"])
    .maybeSingle();
  if (openIssue) return { ok: false, error: "Open issue exists on this order" };

  const sellerOrgId = payment.order?.lot?.event?.org_id;
  if (!sellerOrgId) return { ok: false, error: "Seller organisation not found" };

  const { data: sellerAccountData } = await admin
    .from("seller_stripe_accounts")
    .select(`
      stripe_account_id, payouts_enabled, capability_transfers,
      connect_readiness_status, disabled_reason,
      requirements_currently_due, requirements_past_due
    `)
    .eq("org_id", sellerOrgId)
    .maybeSingle();
  const sellerAccount = sellerAccountData as SellerAccount | null;
  const connectBlock = explainConnectBlock(sellerAccount ?? {});
  if (connectBlock) return { ok: false, error: connectBlock };

  const env: StripeEnv = payment.environment === "live" ? "live" : "sandbox";
  assertLivePaymentsEnabled(env);
  const stripe = createStripeClient(env);
  const idempotencyKey = `offcutt-seller-payout-${payment.id}`;

  try {
    const charge = await resolveChargeDetails(admin, stripe, payment);
    const sourceTransactionUsed = Boolean(charge);
    const originalChargeCents = charge?.amountCents ?? toCents(payment.amount_charged);

    if (payoutCents > originalChargeCents) {
      throw new Error(
        `Seller payout ${payoutCents}c exceeds original charge ${originalChargeCents}c`,
      );
    }
    if (charge && charge.currency !== "aud") {
      throw new Error(`Source charge currency ${charge.currency} does not match aud payout`);
    }

    const attemptAt = new Date().toISOString();
    const { error: attemptUpdateError } = await admin.from("payments").update({
      payout_processing_status: "processing",
      payout_last_error: null,
      payout_last_attempt_at: attemptAt,
      payout_attempt_count: (payment.payout_attempt_count ?? 0) + 1,
      updated_at: attemptAt,
    }).eq("id", payment.id).is("stripe_transfer_id", null);
    if (attemptUpdateError) throw new Error(attemptUpdateError.message);

    await recordReconciliation(admin, payment, sellerOrgId, {
      event_type: "transfer_attempted",
      outcome: "processing",
      idempotency_key: idempotencyKey,
      stripe_charge_id: charge?.id ?? null,
      stripe_balance_transaction_id: charge?.balanceTransactionId ?? null,
      stripe_destination_account_id: sellerAccount!.stripe_account_id!,
      source_transaction_used: sourceTransactionUsed,
      currency: "aud",
      metadata: { note, legacy_balance_fallback: !sourceTransactionUsed },
    });

    const transfer = await stripe.transfers.create({
      amount: payoutCents,
      currency: "aud",
      destination: sellerAccount!.stripe_account_id!,
      ...(charge ? { source_transaction: charge.id } : {}),
      metadata: {
        payment_id: payment.id,
        order_id: payment.order_id,
        seller_org_id: sellerOrgId,
      },
      description: `Offcutt seller payout for order ${payment.order_id.slice(0, 8)}`,
    }, { idempotencyKey });

    if (!transfer.id || !transfer.id.startsWith("tr_")) {
      throw new Error("Stripe did not return a real Transfer ID");
    }

    const awaitingSettlement = charge?.settlementStatus === "pending";
    const transferCreatedAt = new Date().toISOString();
    const { error: updateError } = await admin.from("payments").update({
      payment_mode: "stripe_connect_mode",
      manual_payout_status: "manual_payout_paid",
      manual_payout_reference: transfer.id,
      manual_payout_paid_at: transferCreatedAt,
      stripe_transfer_id: transfer.id,
      stripe_transfer_created_at: transferCreatedAt,
      payout_source_transaction_used: sourceTransactionUsed,
      payout_processing_status: awaitingSettlement
        ? "awaiting_stripe_settlement"
        : "transferred",
      payout_last_error: null,
      admin_notes: note,
      updated_at: transferCreatedAt,
    }).eq("id", payment.id).is("stripe_transfer_id", null);
    if (updateError) {
      throw new Error(
        `Stripe transfer ${transfer.id} was created but database reconciliation failed: ${updateError.message}`,
      );
    }

    await recordReconciliation(admin, payment, sellerOrgId, {
      event_type: "transfer_created",
      outcome: "accepted",
      idempotency_key: idempotencyKey,
      stripe_charge_id: charge?.id ?? null,
      stripe_balance_transaction_id: charge?.balanceTransactionId ?? null,
      stripe_transfer_id: transfer.id,
      stripe_destination_account_id: sellerAccount!.stripe_account_id!,
      source_transaction_used: sourceTransactionUsed,
      currency: "aud",
      metadata: {
        note,
        awaiting_stripe_settlement: awaitingSettlement,
        charge_available_on: charge?.availableOn ?? null,
      },
    });

    return {
      ok: true,
      transfer_id: transfer.id,
      awaiting_settlement: awaitingSettlement,
      source_transaction_used: sourceTransactionUsed,
    };
  } catch (err) {
    const failure = stripeError(err);
    const awaitingSettlement = failure.code === "balance_insufficient";
    await admin.from("payments").update({
      payout_processing_status: awaitingSettlement
        ? "awaiting_stripe_settlement"
        : "failed",
      payout_last_error: failure.message,
      payout_last_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id).is("stripe_transfer_id", null);

    await recordReconciliation(admin, payment, sellerOrgId, {
      event_type: "transfer_failed",
      outcome: "failed",
      idempotency_key: idempotencyKey,
      stripe_destination_account_id: sellerAccount!.stripe_account_id!,
      source_transaction_used: Boolean(payment.stripe_charge_id),
      currency: "aud",
      error_code: failure.code,
      error_message: failure.message,
      metadata: { note, awaiting_stripe_settlement: awaitingSettlement },
    });

    return { ok: false, error: failure.message, error_code: failure.code };
  }
}
