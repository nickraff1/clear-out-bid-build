# Launch QA + Go-Live Plan

Two phases. Phase 1 proves every claimed flow works end-to-end in the live sandbox (Supabase + Stripe test mode) with evidence, not code inspection. Phase 2 is a controlled cutover to live payments and a real auction QA. I stop at each gate for your go/no-go.

Before I start: I need one confirmation and one credential — see "Inputs I need from you" at the bottom.

---

## Phase 1 — Prove sandbox end-to-end (no code changes unless a test fails)

Method for every check:
1. Drive the real preview with Playwright as a real buyer / seller / admin account.
2. After each action, read the deployed Supabase database directly (`supabase--read_query`) and the deployed Stripe sandbox (via edge function or Stripe API through the gateway) to confirm state.
3. Record pass/fail with the concrete row IDs, Stripe object IDs, screenshots, and edge-function log excerpts.
4. If a check fails: stop, root-cause, fix in a small focused patch, redeploy, re-run just that check plus anything downstream of it.

### 1A. Buy-now happy path (single trace, all downstream checks piggyback on this order)
Buyer signs in → opens one of the three seeded fixed-price listings → Buy Now → embedded Stripe Checkout → completes with test card `4242 4242 4242 4242`.

Verify in deployed backend:
- `orders.status = 'paid'`, `payment_reference` set, `pickup_code` present (6 chars), `pickup_status = 'awaiting_arrangement'` → proves "pickup code generates" and "no paid order missing pickup code".
- `payments.status = 'succeeded'`, `stripe_payment_intent_id` set, `manual_payout_status = 'manual_payout_pending'`, `environment = 'sandbox'` → proves "webhook updates order/payment from real Stripe event".
- `lots.status = 'sold'`, `reserved_until = null` → proves "listing disappears after payment" and "no sold listing still buyable".
- Marketplace query no longer returns that lot; direct lot page hides Buy Now.
- `conversations` row exists with `order_id` set; `messages` has the seeded system message → proves "buyer/seller conversation creates in deployed backend".
- `stripe_webhook_events` shows the `checkout.session.completed` / `payment_intent.succeeded` event ids processed once (idempotency).
- `notifications` inserted for buyer (`order_paid`) and seller (`new_sale`).

### 1B. Checkout cancellation
Buyer starts checkout on a second lot → hits Back → `CheckoutCancel` invokes `cancel-pending-order`.
Verify: `orders.status = 'cancelled'`, `payments.status = 'cancelled'` (or row absent), `lots.status = 'active'` (reservation released), notification sent. Also verify a second buyer can immediately purchase the same lot.

### 1C. Failed payment
Buyer starts checkout on a third lot → completes with Stripe test card `4000 0000 0000 0002` (generic decline).
Verify: `payments.status = 'failed'`, `orders.status` remains `pending_payment` then flips to `cancelled` when reservation expires or via webhook `payment_intent.payment_failed`, `lots` returns to `active`, buyer notified. Confirm webhook event recorded in `stripe_webhook_events`.

### 1D. Pickup coordination (uses the 1A order)
- Buyer proposes a future pickup time in `OrderDetail` → `orders.proposed_pickup_at`, `proposed_pickup_by = buyer`. Seller gets `pickup_proposed` notification.
- Seller accepts → `agreed_pickup_at` set. Both parties notified.
- Seller marks ready → `orders.status = 'ready_for_pickup'`, buyer notified.
- Seller enters buyer's `pickup_code` → `orders.status = 'collected'`, `buyer_collected_at`/`seller_confirmed_at` set. Proves "seller can confirm pickup code" and "buyer can propose pickup".
- Also test the past-date guard rejects a proposal at `now() - 1h`.

### 1E. Admin payment / payout ops (uses 1A order)
Admin at `/app/admin/payouts`:
- Sees the succeeded payment row with buyer/seller/net breakdown → proves "admin can view payout/payment".
- Puts payout on hold via `admin_set_payout_status(..., 'manual_payout_on_hold')` → row updates, seller notified.
- Marks manual payout paid → `manual_payout_status = 'manual_payout_paid'`, `manual_payout_paid_at` set, seller notified. Confirm the guard blocks marking paid when order is cancelled/refunded (attempt on 1B/1C orders should error).

### 1F. Admin issue resolution
Buyer opens a report on any lot → admin at `/app/admin/reports` moves it to `investigating` then `resolved` with a note.
Verify `lot_reports.status`, `resolved_by`, `resolved_at`, buyer notification `report_resolved`.

### 1G. Data-integrity sweeps (run last)
Single SQL pass, must all return 0:
- Paid orders with no `pickup_code`.
- Paid orders with no `order_id` conversation.
- Lots in `status = 'active'` that already have a `paid` order.
- Reserved lots past `reserved_until` still marked reserved.
- Duplicate `stripe_webhook_events` for the same event id.

### Deliverable at end of Phase 1
A short report per check: pass/fail, order id, Stripe object id, screenshot path, and any fix applied. **I stop here for your go/no-go before touching live payments.**

---

## Phase 2 — Controlled go-live cutover

Only after Phase 1 is green.

### 2A. Pre-live cleanup (in sandbox first, then applied to live once switched)
- Delete or archive all QA/seed listings, seed events, and test auctions (`lots.title` matching known QA titles, plus the three fixed-price seeds). Keep prod-clean marketplace.
- Cancel any lingering `pending_payment` orders on those lots.
- Zero out `bidder_verifications.failed_payment_count` / `unpaid_auction_count` for the two founder accounts if we test-drove them earlier.

### 2B. Stripe live activation (you do this in Stripe; I verify)
Use `payments--get_go_live_status` to walk the 5-step flow: claim sandbox → complete Stripe onboarding → install Lovable app on live account → Lovable auto-provisions live keys and live webhook → readiness check. I poll and confirm each step before advancing.

### 2C. Secrets + webhook hygiene
- Confirm `STRIPE_LIVE_API_KEY` and `PAYMENTS_LIVE_WEBHOOK_SECRET` land in the runtime secrets after step 4 completes.
- Set `ENABLE_LIVE_PAYMENTS=true`. Leave `ENABLE_AUTOMATED_PAYOUTS` **off** (manual payouts stay the default for launch).
- In the Stripe dashboard, verify exactly two webhook endpoints exist on our handler URL: sandbox → `?env=sandbox`, live → `?env=live`. Delete any endpoint pointing at the legacy `stripe-webhook` function. Confirm no third-party or duplicate endpoint is registered.
- Confirm `auction_deposit_settings.enabled` and gateway mode match the desired launch config.

### 2D. Live smoke test (real card, small amount)
Create one temporary $1–$5 fixed-price listing on a real seller org. You buy it with your own real card. Verify the same checklist as 1A but against `environment = 'live'`. Refund it immediately via `admin-refund-payment` and confirm the refund path (`payment_refunds` row, payout hold, order cancelled/refunded).

### 2E. Live auction QA
Create one short-duration real auction (e.g. 30-min end time) on a real seller org. Second real account (with saved card + accepted terms + any required deposit) places a bid. Auction closes via `close-expired-auctions` cron → winner order created → off-session charge on saved card succeeds → paid-order flow runs end-to-end (pickup code, conversation, notifications). Then run the pickup + admin payout flow live.

### 2F. Post-live monitoring window
Watch `admin_stuck_orders`, `admin_messaging_integrity`, failed `stripe_webhook_events`, and `close-expired-auctions` logs for 24h. Any anomaly triggers a targeted fix.

---

## Guardrails throughout

- No changes to `ENABLE_LIVE_PAYMENTS` or `ENABLE_AUTOMATED_PAYOUTS` outside the explicit gates above.
- No edits to `.env`, `src/integrations/supabase/client.ts`, or generated types.
- Every fix in Phase 1 is a minimal targeted patch tied to a named failing check — no broad refactors during QA.
- I will not claim a check passes without a concrete DB row or Stripe object id as evidence.

## Technical notes

- Playwright drives `http://localhost:8080` inside the sandbox using the injected Supabase session for buyer/seller/admin accounts.
- Stripe assertions use the `createStripeClient` gateway helper via a one-off edge function invocation so no raw Stripe secret is handled by tests.
- Webhook idempotency is validated by re-POSTing the same event id and asserting a single `stripe_webhook_events` row.
- Live-mode listing/auction cleanup uses SQL `UPDATE ... status = 'archived'` (or delete where safe) rather than removing rows referenced by paid orders.

---

## Inputs I need from you before I start

1. **Test accounts for Phase 1.** Confirm I can use `nickraffmgmt@gmail.com` (admin) and `anthony.younes24@gmail.com` (admin) as the driver accounts, plus tell me which existing account to use as the "buyer" and which seller org to use as the "seller". If you'd prefer I create fresh `buyer+qa@…` / `seller+qa@…` accounts, say so.
2. **Phase 2 real-card test.** Confirm you're okay with a single $1–$5 live charge on your own card during 2D (refunded immediately). If not, I'll skip 2D and rely on 2E only.

Once you confirm, I'll execute Phase 1 top-to-bottom and report back with the evidence before touching live payments.