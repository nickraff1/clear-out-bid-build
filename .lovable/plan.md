## Goal

Harden Offcutt auctions against fake/dummy/shill bidders before opening real auctions to beta users. Move protection from "frontend only" to **database constraints + RLS + triggers + edge-function gating + Stripe SetupIntent/off-session charges + admin tools**.

Decisions locked in from the clarifying round:
- **Phasing:** plan now, then execute milestone-by-milestone with your approval between each.
- **Stripe:** switch to direct Stripe SDK with your `STRIPE_SECRET_KEY` so we can save cards (SetupIntent) and auto-charge winners off-session.
- **Beta gating:** email verified + auction terms accepted + payment method on file.
- **Existing bidders:** grandfather anyone who has already bid as `verified_bidder`. Terms acceptance still required on next bid action.

---

## Milestone 1 — Foundation: DB schema, RLS, server-side bid gating

### 1.1 Schema (one migration)

New enum `bidder_status`: `unverified | email_verified | phone_verified | payment_method_added | verified_bidder | trusted_bidder | restricted | banned`.

New tables:

- **`bidder_verifications`** (one row per user)
  - `user_id` (PK, FK auth.users), `status`, `stripe_customer_id`, `stripe_payment_method_id`
  - `email_verified_at`, `phone_verified_at`, `payment_method_verified_at`
  - `auction_terms_accepted_at`, `auction_terms_version` (text, e.g. `"2026-06-27-beta"`)
  - `risk_level` (`low|medium|high`), `failed_payment_count`, `unpaid_auction_count`
  - `restricted_reason`, `restricted_by`, `restricted_at`
  - `created_at`, `updated_at`
- **`auction_deposits`**
  - `id`, `user_id`, `lot_id`, `bid_id`, `order_id`, `amount`
  - `status` (`not_required | required | authorized | charged | applied_to_order | refunded | released | forfeited | failed`)
  - `stripe_payment_intent_id`, `stripe_setup_intent_id`, `payment_method_id`
  - `expires_at`, `admin_notes`, `created_at`, `updated_at`
- **`bidder_audit_log`** (admin actions: restrict, ban, bid_removed, deposit_forfeited, etc.)

New row in `fee_settings` for deposit thresholds (single JSONB row keyed `'auction_deposits'`):
```
{ enabled, thresholds: [{max_invoice, fee}, ...], trusted_waived, auto_charge_winner, winner_deadline_hours }
```
Seeded with the table from the spec (≤$250→$0, $251–1k→$25, … ≥$10k→$1000).

RLS:
- `bidder_verifications`: user sees/edits own; admin sees all; service_role full.
- `auction_deposits`: user sees own; seller sees deposits on their lots (status only, no Stripe IDs); admin full.
- All grants per the public-schema rule.

### 1.2 Helper functions (SECURITY DEFINER)

- `public.get_bidder_status(uuid) → bidder_status`
- `public.can_user_bid(_user_id, _lot_id) → table(allowed boolean, reason text, required_deposit numeric)` — single source of truth used by both the edge function and the UI badge.
- `public.required_deposit_for(_amount numeric, _user_id uuid) → numeric` — applies tier table + trusted waiver.

### 1.3 Grandfather migration

In the same migration: for every distinct `user_id` in `bids`, upsert `bidder_verifications` with `status='verified_bidder'`, `auction_terms_accepted_at = null` (so they must accept on next bid).

### 1.4 Rewrite `auction-engine` place-bid

Server-side rejections (no client trust):
1. Auth required.
2. `can_user_bid()` must return `allowed=true`.
3. Status not in `restricted|banned`.
4. Terms accepted (matches current `auction_terms_version`).
5. Payment method on file (after Milestone 2 — until then this check is feature-flagged off, see "interim mode" below).
6. Lot active, auction not ended.
7. Not seller / seller-org member (already exists via `prevent_seller_self_bid` trigger — keep it).
8. Bid ≥ minimum increment.
9. No unresolved `unpaid_auction_count > 0` defaults.
10. If `required_deposit > 0` and Milestone 3 shipped: deposit must be `authorized` for this lot.

DB trigger `before_insert_bids` calls `can_user_bid()` as a backstop so even direct DB writes can't bypass the edge function.

### 1.5 Interim mode (Milestone 1 only)

Until Milestone 2 lands, the payment-method check returns `allowed=true` with `reason='payment_method_pending'` — the UI shows "Payment method verification coming soon — bidding allowed in beta with email + terms only." Once M2 ships, the same check starts hard-blocking.

---

## Milestone 2 — Stripe switch + payment method on file

### 2.1 Switch to direct Stripe SDK

You provide `STRIPE_SECRET_KEY` via `add_secret`. New edge functions:
- `stripe-create-setup-intent` — creates a Stripe customer if missing, returns a SetupIntent client secret.
- `stripe-save-payment-method` — webhook handler for `setup_intent.succeeded`; updates `bidder_verifications.stripe_payment_method_id`, `payment_method_verified_at`, advances status from `email_verified` → `payment_method_added` → `verified_bidder`.
- Existing `create-checkout` stays as-is for buy-now and winner pay-now flows (no rewrite — checkout sessions are fine for on-session payments).

### 2.2 Verification page

New page `/app/verify-bidder` with three steps:
1. Email verified (auto from Supabase auth).
2. Accept auction terms (links to `/auction-terms`, stores version).
3. Add payment card (Stripe Elements `<PaymentElement>` with SetupIntent).

Bid modal becomes a gate: if `can_user_bid()` returns `allowed=false`, the modal shows the failing reason and a "Verify to bid" CTA → `/app/verify-bidder`.

### 2.3 Flip the gating flag

Edge function starts hard-rejecting bids without a saved payment method.

---

## Milestone 3 — Deposits, auto-charge, default-fee flow

### 3.1 Deposit authorization at bid time

When `required_deposit_for(bid_amount, user) > 0`:
- New edge function `auction-create-deposit-hold` creates a Stripe PaymentIntent with `capture_method='manual'` and `off_session=true` against the saved card, for the deposit amount.
- `auction_deposits` row written with `status='authorized'`.
- Bid only accepted after authorization succeeds. If card declines: bid rejected, surface "Your card couldn't authorize the $X auction deposit."

When a higher bid arrives, the previous bidder's deposit is **released** (`stripe.paymentIntents.cancel`) and marked `released`. Only the current winning bidder holds an authorization.

Trusted bidders (`status='trusted_bidder'`) skip the hold when `trusted_waived=true`.

### 3.2 Auction close → winner charge

Modify `close_expired_auction` SQL function + add new edge function `auction-charge-winner`:
- On close with reserve met: create order as today.
- If `auto_charge_winner_enabled`: call `stripe-charge-winner` edge function which uses the saved PM with `off_session=true, confirm=true` for the full order amount. Capture the deposit hold and apply as credit (or release it and charge full).
- On success: order → `paid`, lot → `sold`, pickup workflow starts (unchanged).
- On failure: order → `payment_failed`, bidder status → `restricted`, `failed_payment_count += 1`, notify buyer with deadline = `winner_payment_deadline_hours`.

### 3.3 Deadline expiry → default

New scheduled function `auction-default-sweep` (runs hourly, same pattern as `close-expired-auctions`):
- Find orders with `status='payment_failed'` past deadline.
- Capture the deposit hold → mark `auction_deposits.status='forfeited'`.
- Order → `buyer_failed_to_pay`; bidder `unpaid_auction_count += 1` → status `restricted`.
- Notify seller with two actions: "Offer to next bidder" / "Relist".

### 3.4 Next-bidder offer

New RPC `admin_or_seller_offer_to_next_bidder(_lot_id)`:
- Finds second-highest bid above reserve.
- Creates new order for that bidder with shortened deadline (12 h).
- Sends `next_bidder_offer` notification.

---

## Milestone 4 — Admin risk tools, seller/buyer UI, legal pages

### 4.1 Admin

New page `/app/admin/bidders`:
- Bidder list with verification status, risk level, failed/unpaid counters.
- Per-bidder drawer: bid history across all lots, deposits, linked accounts (same `stripe_customer_id` or shared IP/device — best-effort), restrict/ban actions with reason.

New panel on `/app/admin/orders` row drawer:
- "Flag suspicious bid" / "Remove bid" actions → server function `admin_remove_bid(_bid_id, _reason)` which: sets `bids.is_winning=false`, recomputes lot `current_bid` from remaining bids, writes `bidder_audit_log`, notifies bidder.

RPCs: `admin_restrict_bidder`, `admin_ban_bidder`, `admin_unrestrict_bidder`, `admin_remove_bid`, `admin_forfeit_deposit`.

### 4.2 Seller dashboard additions

On `/app/seller/orders` and `EventDetail` lots:
- "Highest bidder verified" badge (green check or amber pending).
- Deposit protection chip ("$250 deposit held" / "No deposit required").
- Payment-pending / payment-failed / defaulted states with seller actions (Offer to next bidder, Relist).

### 4.3 Buyer dashboard additions

On `/app/buyer/overview`:
- "Bidder verification" status card with progress (Email ✓ / Terms ✓ / Payment method ✓ / Verified).
- "Auction deposits" section showing active holds, refunded, forfeited.
- Restricted/banned banner with explanation + appeal contact when applicable.

Bid modal redesign (matches Offcut Sydney inline-sidebar pattern, not a modal where possible) showing: current bid, min next, your bid, buyer fee, est. total, required deposit, PM status, binding-terms checkbox.

### 4.4 Legal pages (beta wording)

New routes under existing `/legal/` pattern:
- `/auction-terms` — binding bids, payment, pickup, default fees, deposit refund/forfeit rules.
- `/buyer-default-policy` — what counts as default, what fees apply, restriction/ban consequences.
- `/prohibited-bidding-policy` — dummy/shill/self/rigging definitions, removal & ban rights, deposit forfeiture.

Footer: each page banner-tagged "Beta — pending legal review".

### 4.5 Notifications

Extend `notify_user`/`notify_org`/`notify_admins` calls in triggers and edge functions for every event listed in spec sections 9 (buyer/seller/admin). No new infra — just additional `notify_*` invocations at the right transition points.

---

## Technical notes

- **Files touched (M1):** new migration; rewrite `supabase/functions/auction-engine/index.ts`; tiny update to `place_bid` triggers in DB.
- **Files touched (M2):** `add_secret STRIPE_SECRET_KEY`; new `supabase/functions/stripe-setup-intent/`, `supabase/functions/stripe-payment-method-webhook/`; new `src/pages/app/VerifyBidder.tsx`; new `src/lib/bidder.ts` hook.
- **Files touched (M3):** new edge functions `auction-create-deposit-hold`, `auction-charge-winner`, `auction-default-sweep`; SQL update to `close_expired_auction`.
- **Files touched (M4):** new `src/pages/app/admin/AdminBidders.tsx`; updates to `AdminOrders`, `SellerOrders`, `EventDetail`, `BuyerOverview`, `LotDetail` (bid sidebar); three new legal pages; routes in `App.tsx`.

Stripe API version pinned at `2026-03-25.dahlia` (matches existing shared utility pattern).

Out of scope: SMS/phone verification (not needed for beta gate), Stripe Connect for seller payouts (separate work), device-fingerprint linked-account detection (admin gets a "same email/PM" join only).

---

## Proposed execution order

1. **M1** — ship and let you smoke-test bidder gating + grandfathering on existing data.
2. **M2** — switch Stripe + payment method on file.
3. **M3** — deposits and auto-charge (highest-risk surface; ship last with most testing).
4. **M4** — admin tools, polished buyer/seller UI, legal pages.

Reply "proceed with M1" (or any subset) and I'll start writing the migration. Each milestone is one round of changes you can QA before the next one lands.