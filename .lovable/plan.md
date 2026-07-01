# Go-Live Step-by-Step Plan (Phase 2B → 2F)

Phase 2A cleanup is already done. This plan walks you through every remaining step to accept real money. You do the Stripe-side actions; I verify each one before unlocking the next. Nothing switches to live until every gate passes.

---

## Step 1 — Claim your Stripe account (you, in Stripe)

**What you do:**
1. Open the Payments tab in Lovable → click the go-live wizard.
2. Click the claim link. Stripe opens a page titled *"Create a Stripe account to claim this sandbox from Lovable"*.
3. Either create a new Stripe account (email, password, country = Australia) **or** sign in to an existing one to link it.
4. Confirm the "Verify your email address" email Stripe sends you.

**What I do to verify:** poll `payments--get_go_live_status`. Step 1 flips to complete when Stripe reports the sandbox as `claimed`.

**Gate:** do not move on until step 1 shows complete.

---

## Step 2 — Complete Stripe's "Activate your account" wizard (you, in Stripe)

**What you do (all inside Stripe's dashboard):**
1. **Verify your business** — business type, ABN if company, personal details, address, website (`https://clear-out-bid-build.lovable.app` or your custom domain), business description ("Online marketplace for construction surplus / offcuts sold via fixed-price and auction"), and product description.
2. **Add your bank** — AU bank account for payouts (BSB + account number).
3. **Secure your account** — enable 2FA.
4. **Extras** — skip unless you already have tax settings ready. GST can be configured later.
5. **Review and submit.**
6. Stripe then shows *"You're now in your live account"* and asks *"Choose what to copy"* from sandbox → **tick everything, and make sure the Lovable app is included.** This can save Step 3.

**What I do to verify:** poll `payments--get_go_live_status`. Step 2 completes when Stripe's `app_install_status` advances past `pending_onboarding`.

**Gate:** do not move on until step 2 shows complete.

---

## Step 3 — Install the Lovable app on your LIVE account (you, in Stripe)

**What you do:** if Step 2's "Choose what to copy" already included the Lovable app, this is auto-complete. Otherwise, click the install link in the Payments tab wizard and approve the Lovable app on your live account.

**What I do to verify:** poll status until `app_install_status == "installed"`.

**Gate:** do not move on until step 3 shows complete.

---

## Step 4 — Live API keys provision automatically (Lovable, no action from you)

Lovable's provisioning workflow fires when Step 3 completes. It:
- pulls your live account,
- mints `STRIPE_LIVE_API_KEY`,
- registers the live webhook endpoint → `payments-webhook?env=live`,
- writes `PAYMENTS_LIVE_WEBHOOK_SECRET` into runtime secrets.

**What I do:** poll until `hasLiveKeys == true`, then confirm both secrets are present via `secrets--fetch_secrets`.

**Gate:** both `STRIPE_LIVE_API_KEY` and `PAYMENTS_LIVE_WEBHOOK_SECRET` must show as configured.

---

## Step 5 — Readiness check (Lovable, one click from you)

**What you do:** click "Run readiness check" in the Payments tab.

**What I do:** if any check fails and is agent-fixable, I fix it in a small patch and you re-run. If it needs a Stripe dashboard change (e.g. statement descriptor), I tell you exactly what to change.

**Gate:** readiness check green.

---

## Step 6 — Secrets & webhook hygiene (me, verify only)

I will:
1. Confirm the two required runtime secrets from Step 4 are present.
2. Set `ENABLE_LIVE_PAYMENTS=true` via `secrets--set_secret`.
3. Leave `ENABLE_AUTOMATED_PAYOUTS` **unset/false** — manual seller payouts remain the launch default.
4. Ask you to open Stripe → Developers → Webhooks and confirm exactly two endpoints exist on our handler URL:
   - sandbox → `.../payments-webhook?env=sandbox`
   - live → `.../payments-webhook?env=live`
5. Have you delete any legacy `stripe-webhook` endpoint and any duplicate endpoints.
6. Replace `VITE_PAYMENTS_CLIENT_TOKEN` with your **live** Stripe publishable key (`pk_live_...`) — you paste the key, I store it via `secrets--update_secret`.
7. Confirm `auction_deposit_settings.current_gateway_mode` is set to live via a small SQL check.

**Gate:** `ENABLE_LIVE_PAYMENTS=true`, exactly 2 webhook endpoints, live publishable key in place.

---

## Step 7 — Live smoke test: $1–$5 real card (you + me)

**What you do:**
1. Create one real fixed-price listing on a real seller org at $1–$5 (I can seed it if you tell me which seller org).
2. From a different logged-in account (or incognito), buy it with your own real card.

**What I verify in the deployed backend right after purchase:**
- `orders.status = 'paid'`, `pickup_code` present, `environment = 'live'` on the payment.
- `payments.status = 'succeeded'`, `stripe_payment_intent_id` set, `manual_payout_status = 'manual_payout_pending'`.
- `lots.status = 'sold'`, hidden from marketplace.
- `stripe_webhook_events` shows the live event id processed once.
- Buyer + seller notifications fired; order conversation created.

**Then refund:** I call `admin-refund-payment` from the admin console.
- `payment_refunds` row inserted,
- payment marked refunded,
- payout put on hold,
- order flipped to cancelled/refunded.

**Gate:** every check above returns evidence (row IDs + Stripe IDs). If anything fails, we stop, root-cause, patch, re-run.

---

## Step 8 — Live auction end-to-end (you + me)

**What you do:**
1. Create a real short auction (30-min end time) on a real seller org, low reserve.
2. From a second real account that has: verified bidder row + saved card + accepted current auction terms + any required deposit tier, place at least one bid.

**What happens automatically:**
- `close-expired-auctions` cron closes the auction at end time.
- Winner order created.
- `charge-auction-winner` charges the saved card off-session.
- Same paid-order flow as Step 7 runs.

**What I verify:** same checklist as Step 7, plus that `auction_deposits` is released/captured correctly and the winner's bidder profile counters are unchanged (no false default).

**Then:** run the pickup handshake live (buyer proposes → seller accepts → seller marks ready → seller enters pickup code → order collected) and mark the manual payout **Paid** in `/app/admin/payouts`.

**Gate:** auction paid-order flow completes end-to-end on live.

---

## Step 9 — 24h post-live monitoring window (me)

I watch these once per day for 24h and flag anything red:
- `admin_stuck_orders` view
- `admin_messaging_integrity` view
- failed rows in `stripe_webhook_events`
- `close-expired-auctions` edge function logs
- any new `payment_refunds` or `manual_payout_status = 'manual_payout_failed'`

Any anomaly → targeted fix, no broad changes.

---

## What I need from you to start

1. **Confirm you're ready to run Step 1 now.** Once you click the claim link in the Payments tab and finish claiming, tell me and I'll poll status.
2. **Confirm you're OK with a real $1–$5 charge on your own card at Step 7** (refunded immediately). If not, we skip Step 7 and rely on Step 8 only.
3. **Tell me which real seller org** to attach the Step 7 smoke listing and Step 8 auction to, and which second real account will act as the buyer/bidder.

Reply with those three and I'll open the Payments tab status and walk you through Step 1 live.
