import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

describe("Stripe source-transaction payouts", () => {
  it("persists the Charge ID from checkout, webhook and auction success paths", () => {
    const webhook = read("supabase/functions/payments-webhook/index.ts");
    const auctionCharge = read("supabase/functions/_shared/auction-winner-charge.ts");
    const checkout = read("supabase/functions/create-checkout/index.ts");

    expect(webhook).toContain("latest_charge");
    expect(webhook).toContain("stripe_charge_id: charge.chargeId");
    expect(webhook).toContain('case "charge.succeeded"');
    expect(auctionCharge).toContain("stripe_charge_id: charge.id");
    expect(auctionCharge).toContain("Succeeded auction payment did not return a Stripe Charge ID");
    expect(checkout).toContain('source: "offcutt_checkout"');
    expect(checkout).toContain("payment_intent_data");
  });

  it("uses the source Charge, hard amount guards and a stable idempotency key", () => {
    const transfer = read("supabase/functions/_shared/seller-transfer.ts");

    expect(transfer).toContain("source_transaction: charge.id");
    expect(transfer).toContain("payoutCents > originalChargeCents");
    expect(transfer).toContain("payoutCents <= 0");
    expect(transfer).toContain("offcutt-seller-payout-${payment.id}");
    expect(transfer).toContain("{ idempotencyKey }");
    expect(transfer).toContain('transfer.id.startsWith("tr_")');
    expect(transfer).toContain('skipped: "already_transferred"');
    expect(transfer).toContain('manual_payout_status === "manual_payout_on_hold"');
  });

  it("creates an admin-only accounting ledger without inventing tax", () => {
    const migration = read(
      "supabase/migrations/20260715040000_source_transaction_reconciliation.sql",
    );
    const adminPage = read("src/pages/app/admin/AdminReconciliation.tsx");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.payment_transfer_reconciliation");
    expect(migration).toContain("USING (public.is_admin(auth.uid()))");
    expect(migration).toContain("CREATE VIEW public.admin_payment_reconciliation");
    expect(migration).toContain("tax_calculation_status text NOT NULL DEFAULT 'not_configured'");
    expect(migration).toContain("Cannot mark payout paid without a real Stripe Transfer ID");
    expect(migration).toContain("ch_3TqPMbELbxGcXLeZ1mCzEltA");
    expect(migration).toContain("stripe_transfer_id IS NULL");
    expect(adminPage).toContain("Stripe object chain");
    expect(adminPage).toContain("GST/tax has not been configured");
  });

  it("uses truthful settlement wording for admins and sellers", () => {
    const adminPayouts = read("src/pages/app/admin/AdminPayouts.tsx");
    const sellerPayouts = read("src/pages/app/seller/SellerPayouts.tsx");
    const expected = "Awaiting Stripe funds settlement";
    const helper = "Your payout has been approved and will be released automatically once the buyer’s payment becomes available in Stripe.";

    expect(adminPayouts).toContain(expected);
    expect(adminPayouts).toContain(helper);
    expect(sellerPayouts).toContain(expected);
    expect(sellerPayouts).toContain(helper);
  });
});
