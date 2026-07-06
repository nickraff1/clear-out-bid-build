// Shared helper: create a Stripe transfer from platform balance to a seller's
// Connect account for a given `payments` row. Used by both the automated
// trigger (auto-payout-on-collected, sweep-unpaid-payouts) and the manual
// admin path (admin-create-seller-transfer).
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv, assertLivePaymentsEnabled } from "./stripe.ts";
import { explainConnectBlock } from "./connect-status.ts";

type Admin = ReturnType<typeof createClient>;

export type TransferOutcome =
  | { ok: true; transfer_id: string }
  | { ok: false; skipped: string; transfer_id?: string }
  | { ok: false; error: string };

type PaymentRow = {
  id: string;
  order_id: string;
  status: string;
  seller_payout: number | string;
  stripe_transfer_id: string | null;
  environment: string | null;
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

type SettingsRow = { auto_payouts_enabled: boolean | null };

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
      id, order_id, status, seller_payout, stripe_transfer_id, environment,
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
  if (payment.order?.status !== "collected") {
    return { ok: false, error: "Order must be collected before seller transfer" };
  }

  // Block on open issues.
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
  const transfer = await stripe.transfers.create({
    amount: Math.round(Number(payment.seller_payout) * 100),
    currency: "aud",
    destination: sellerAccount!.stripe_account_id!,
    metadata: {
      payment_id: payment.id,
      order_id: payment.order_id,
      seller_org_id: sellerOrgId,
    },
    description: `Offcutt seller payout for order ${payment.order_id.slice(0, 8)}`,
  });

  await admin.from("payments").update({
    payment_mode: "stripe_connect_mode",
    manual_payout_status: "manual_payout_paid",
    manual_payout_reference: transfer.id,
    manual_payout_paid_at: new Date().toISOString(),
    stripe_transfer_id: transfer.id,
    admin_notes: note,
    updated_at: new Date().toISOString(),
  }).eq("id", payment.id);

  return { ok: true, transfer_id: transfer.id };
}
