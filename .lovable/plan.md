
# M3 — Bidder Commitment, Deposits & Default Handling

Built on the existing Lovable sandbox Stripe gateway (`lovable_gateway_sandbox`). No live payments, no Stripe Connect, no fake automation — anything the sandbox can't do is scaffolded with an explicit admin state instead of being simulated.

## 1. Payment-mode flag (explicit, future-ready)

Add a single source of truth so we can later switch to live / Connect without rewrites.

- New enum `payment_mode`: `lovable_gateway_sandbox | lovable_gateway_live | stripe_connect_future`.
- New row in `platform_settings` (or extend `auction_deposit_settings`) with `current_payment_mode` — defaulted to `lovable_gateway_sandbox`.
- Stamp every `payments`, `auction_deposits`, and bidder-charge row with the mode that created it.
- Show the active mode in the admin header and on the Launch Readiness page.

## 2. Bidder verification states (full set)

Extend the `bidder_status` enum to the full M3 set:

`unverified → payment_method_required → payment_method_added → auction_terms_accepted → verified_bidder → trusted_bidder`, plus `restricted` and `banned`.

- Update `can_user_bid` so only `verified_bidder` and `trusted_bidder` may bid (everything else returns a specific reason code already wired into `reasonCopy`).
- Status auto-advances as the user completes each step (email confirm → add card → accept terms → verified). `trusted_bidder` remains admin-only.
- Backfill existing `email_verified` rows into the new states based on what they already have on file.

## 3. Tiered deposit / default-fee model

Seed `auction_deposit_settings.thresholds` with the Grays-style ladder (≤$250 $0, ≤$1k $25, ≤$2.5k $75, ≤$5k $250, ≤$10k $500, >$10k $1,000) and expose an admin editor at `/app/admin/fees` so the ladder is fully configurable.

`required_deposit_for(amount, user)` already drives `can_user_bid` — no signature change needed.

## 4. Deposit authorization at bid time

Where the sandbox supports it: place a Stripe `PaymentIntent` with `capture_method=manual` against the saved card for the tier amount whenever a bid crosses into a higher deposit band. We hold one active auth per (user, lot); previous auth is released when superseded or when the user is outbid for >10 min.

- New edge function `authorize-bid-deposit` — creates/updates the PaymentIntent through the gateway and writes an `auction_deposits` row (`status`: `requires_action | authorized | released | captured | failed`).
- Bid trigger refuses the bid if the latest deposit row for that tier isn't `authorized`.
- If the sandbox rejects manual-capture (gateway limitation), the row is written as `scaffolded_unsupported` and the admin Deposits view shows a clear "gateway cannot authorize — manual follow-up" badge. No silent success.

## 5. Winner payment flow

- On auction close (`close_expired_auction`) the existing order is already created with a 24h reservation. Add a follow-up edge function `charge-winner` that:
  - Tries to capture the held deposit (if any) toward the order total.
  - Creates a Checkout Session for the remaining balance and emails/notifies the winner.
- Webhook (`payments-webhook`) handles `payment_intent.succeeded` / `.payment_failed` / `.canceled` and updates `orders.status`, `auction_deposits.status`, and the bidder's `failed_payment_count`.

## 6. Failed-payment & default handling

- After 24h unpaid, scheduled job `handle-defaulted-winners` runs:
  1. Capture the held deposit as a **default fee** (`auction_deposits.status='captured'`, `purpose='default_fee'`).
  2. Increment `bidder_verifications.unpaid_auction_count` and `failed_payment_count`. Two strikes ⇒ auto `restricted`.
  3. Release the lot reservation.
  4. Insert an admin notification offering "Offer to next highest bidder" or "Relist".
- New RPC `offer_to_next_bidder(lot_id)` — creates a fresh order for the runner-up at their last bid amount, 24h reservation, notifies them.
- New RPC `relist_auction(lot_id, new_end)` — clones the lot back to `active`.

## 7. Admin risk tools (`/app/admin/bidders`)

New page listing every `bidder_verifications` row with filters (status, unpaid count, failed payments, risk level). Per-bidder drawer with:

- Status changer (restrict / ban / mark trusted) — already wired via `admin_set_bidder_status`.
- Deposits & default-fee history.
- Unpaid auction history with links to orders.
- Action buttons: "Remove suspicious bid", "Offer to next highest bidder", "Relist auction", "Mark deposit refunded / applied / forfeited".
- Audit log tail from `bidder_audit_log`.

Also add a "Suspicious bids" tab on `/app/admin/listings` powered by simple heuristics (sniping in last 5s by an unverified-recent account, repeated outbid-then-cancel patterns).

## 8. Public policy pages

Add three new legal pages reusing `LegalPage.tsx`:

- `/auction-terms` — binding-bid attestation copy (exact wording from the request).
- `/buyer-default-policy` — what happens when a winner doesn't pay (deposit captured, account restricted, item re-offered/relisted).
- `/prohibited-bidding-policy` — self-bidding, shill bidding, sniping with throwaway accounts, etc.

The acceptance dialog in `LotDetail` links to all three; `accept_auction_terms` continues to record the version.

## 9. Server-side bid rejection (single source of truth)

Confirm every rule lives in `can_user_bid` + `enforce_bidder_eligibility` trigger + `auction-engine`:

verified ✓ · payment method ✓ · terms ✓ · deposit satisfied (new) · not restricted/banned ✓ · not seller ✓ · lot active ✓ · auction not ended ✓ · min increment ✓ (already enforced in auction-engine).

## 10. Seller payouts — honest labelling

No change to payout mechanics. Audit copy across `AdminPayouts`, `SellerPayouts`, and order detail so nothing says "automatic Stripe Connect payout". Replace with "Manual payout — tracked by Offcutt ops" badge wherever a `payments.manual_payout_status` row drives the UI.

---

## Technical notes

**Migrations**
- Extend `bidder_status` enum; backfill existing rows.
- Add `payment_mode` enum + `current_payment_mode` setting; stamp on `payments` and `auction_deposits`.
- Add columns to `auction_deposits`: `purpose` (`bid_hold | default_fee | refund`), `stripe_payment_intent_id`, `tier_band`, `released_at`, `captured_at`.
- New RPCs: `offer_to_next_bidder`, `relist_auction`, `mark_deposit_outcome`.
- Update `can_user_bid` to check latest deposit row vs `required_deposit_for`.

**Edge functions** (all `verify_jwt=false` where the gateway calls back, otherwise authed)
- `authorize-bid-deposit` — manual-capture PaymentIntent via `_shared/stripe.ts`.
- `charge-winner` — capture deposit + Checkout Session for balance.
- `handle-defaulted-winners` — scheduled hourly via `pg_cron`.
- Extend `payments-webhook` for `payment_intent.*` events and deposit lifecycle.

**Frontend**
- `LotDetail.tsx` — show deposit tier and "Authorize $X deposit" step in the bid sidebar; refresh on outbid.
- New `/app/admin/bidders` page + drawer.
- Admin Fees editor for tier ladder.
- Payment-mode badge in admin header.
- "Suspicious bids" tab + bid-remove confirmation.

**Out of scope for M3**
- Live keys / go-live flow.
- Stripe Connect / automated seller payouts.
- KYC/ID verification beyond email + saved card.
- Buyer-facing dispute portal (covered by existing `/refunds-and-disputes`).

**Gateway-unsupported fallback rule**
Any sandbox action that fails or isn't supported is recorded as `scaffolded_unsupported` with a visible admin badge and a "manual follow-up required" notification — never silently marked as success.
