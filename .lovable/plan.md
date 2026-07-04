
# Enable Stripe Connect Seller Onboarding + Automated Payouts (Live)

## Context

Stripe is already live through the Lovable-managed gateway. The active payment flow (`create-checkout` → `payments-webhook` → `admin-refund-payment` → `admin-create-seller-transfer`) is fully wired through the gateway helper. The platform collects 100% at checkout, then pushes `stripe.transfers.create` to each seller's Connect Express account.

Two missing pieces:
1. **Seller onboarding** — `stripe-connect-onboard` is legacy code referencing the non-existent `STRIPE_SECRET_KEY`, and `PaymentSettings.tsx` is a "Coming Soon" placeholder.
2. **Automated payouts** — `admin-create-seller-transfer` already contains the correct transfer logic but is gated behind `ENABLE_AUTOMATED_PAYOUTS=true` AND must be triggered manually per payment by an admin. There is no automatic trigger when an order transitions to `collected`.

No new secrets required. The `mk_…` value from earlier is unused and can be deleted.

## Changes

### 1. Refactor `stripe-connect-onboard` to use the gateway
`supabase/functions/stripe-connect-onboard/index.ts`
- Replace `Deno.env.get("STRIPE_SECRET_KEY")` + direct SDK with `createStripeClient(env)` from `_shared/stripe.ts`.
- Accept `environment: "sandbox" | "live"` via `normalizeRequestedEnvironment`.
- Add JWT check (`admin.auth.getUser(token)`) and org-membership check (caller must be a member of `org_id`).
- Persist created `stripe_account_id` and `account_status: 'pending'` on `seller_stripe_accounts`.
- Return `{ url, account_id }` — mint a fresh account link every call (single-use).

Add `verify_jwt = false` for this function in `supabase/config.toml`.

### 2. Add `account.updated` handling to `payments-webhook`
`supabase/functions/payments-webhook/index.ts`
- New `case "account.updated"` reading `id`, `charges_enabled`, `payouts_enabled`, `details_submitted` and updating `seller_stripe_accounts` keyed by `stripe_account_id`.
- `account_status = details_submitted ? 'active' : 'pending'`.

### 3. Replace `PaymentSettings.tsx` placeholder with real onboarding UI
`src/pages/app/seller/PaymentSettings.tsx`
- On mount, query `seller_stripe_accounts` for `primaryOrg.id` and reflect real state: `Not connected` / `Pending verification` / `Ready to receive payouts` / `Restricted`.
- "Connect Payment Account" → invoke `stripe-connect-onboard` with `{ org_id, return_url: window.location.href, environment }` then `window.location.assign(url)`.
- "Manage Payment Account" (when connected) → same invoke, opens fresh Express dashboard link.
- Refetch status on window focus so returning from Stripe reflects new state.

### 4. Automated payout trigger on order completion
This is the new piece.

**New edge function `auto-payout-on-collected`** (or fold into `_shared/paid-order.ts`):
- Called when an order transitions to `collected`.
- Reads the `payments` row for that order, verifies `status = 'succeeded'`, `stripe_transfer_id IS NULL`, no open `lot_reports`, and seller has `payouts_enabled = true`.
- Invokes the same transfer logic currently in `admin-create-seller-transfer` (extracted to `_shared/seller-transfer.ts` so both call sites share it).
- Writes `stripe_transfer_id`, `manual_payout_status='manual_payout_paid'`, `payment_mode='stripe_connect_mode'`.

**Trigger mechanism** — pgnet call from a Postgres trigger on `orders` when `status` becomes `collected`:
```sql
CREATE OR REPLACE FUNCTION public.trigger_auto_payout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'collected' AND OLD.status IS DISTINCT FROM 'collected' THEN
    PERFORM net.http_post(
      url := '<project>/functions/v1/auto-payout-on-collected',
      headers := jsonb_build_object('Content-Type','application/json','apikey','<anon>'),
      body := jsonb_build_object('order_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END $$;
```
Requires `pg_net` extension enabled. Trigger URL + anon key injected via `supabase--insert` (not migration) so remixes don't leak the project ref.

**Retry / backstop cron** — a new `sweep-unpaid-payouts` scheduled function every 15 min that finds `payments` where `status='succeeded'`, `order.status='collected'`, `stripe_transfer_id IS NULL`, no open reports, and reruns the transfer helper. Guards against dropped `pg_net` calls, transient Stripe failures, or sellers who complete Connect after the order was collected.

**Refactor** `admin-create-seller-transfer` to call the same shared helper — keeps admin-triggered manual retries working and drops the `ENABLE_AUTOMATED_PAYOUTS` env gate (payouts become the default path).

### 5. Automated-payout kill switch
Replace the boolean `ENABLE_AUTOMATED_PAYOUTS` env gate with a row on `auction_deposit_settings` (or a small new `platform_settings` row): `auto_payouts_enabled boolean default true`. Admin UI can flip it if needed. All three call sites (auto function, cron sweep, admin function) check this flag.

### 6. Delete legacy dead files
- `supabase/functions/stripe-checkout/index.ts` — superseded by `create-checkout`.
- `supabase/functions/stripe-webhook/index.ts` — superseded by `payments-webhook`.

Both reference `STRIPE_SECRET_KEY` and are not called from anywhere.

### 7. Admin surfacing
`AdminPayouts.tsx` (already exists) — add columns/badges showing `stripe_transfer_id` and auto-payout status so admins can see the automated flow, and expose a "Retry payout" button that hits `admin-create-seller-transfer` for anything the sweep couldn't process (e.g. seller not yet onboarded).

## Fund flow after this ships

```text
Buyer pays $110 (base $100 + 10% buyer fee)
  → Platform Stripe balance: +$110
Order marked `collected` (buyer confirms pickup)
  → pg_net trigger fires auto-payout-on-collected
  → stripe.transfers.create $90 → seller Connect account
  → Platform net revenue: $110 - $90 = $20 (10% buyer fee + 10% seller commission)
Seller receives $90 in their Stripe balance
  → Stripe pays out to their bank on their Express payout schedule (daily/weekly)
```

## Not in scope

- Refund reversal of transfers (Stripe holds this via `reversals` API; existing `admin-refund-payment` puts payout on hold — that's the correct interim behaviour and out of scope for this pass).
- Changes to `create-checkout` or the auction-winner charging path — those already work.
- Admin "force payout" for sellers whose Connect account isn't ready — sweep cron will pick them up automatically once they onboard.

## Rollout order

1. Ship refactor of `stripe-connect-onboard` + `payments-webhook` `account.updated` + new `PaymentSettings` UI + delete legacy files.
2. Seller completes Connect onboarding via new UI.
3. Ship shared transfer helper + `auto-payout-on-collected` function + pg_net trigger + sweep cron + kill switch + `AdminPayouts` retry button.
4. Verify with a small manual smoke test (finish the marble auction, pay, mark collected, watch transfer land).
