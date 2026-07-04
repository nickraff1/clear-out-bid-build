# Phase 2B — Live Smoke Test with Two Real Accounts

Replaces the earlier "seed a QA listing" approach. We'll use two genuine accounts so the live-mode path is exercised end-to-end, including Stripe Connect onboarding.

## Accounts to create

You will create both, using two email inboxes you control:

1. **Seller account** — a real seller org that will list one low-value item (~$1–$5).
2. **Buyer account** — a real buyer that will purchase it with your real card.

Use different emails than your admin account (`nickraffmgmt@gmail.com` / `anthony.younes24@gmail.com`) so we don't muddy admin data.

## Step-by-step

### 1. Create the seller account
- Sign up at `/signup` with seller email
- Complete onboarding → choose **Seller** role
- Give the org a real business name (not "QA" / "Test")

### 2. Complete Stripe Connect onboarding (seller side) — **required before the purchase**
- Go to `/app/seller/payments` (Payment Settings)
- Click **Connect Stripe account** → complete the Stripe-hosted KYC form (business type, ID, bank account)
- Wait until Payment Settings shows `charges_enabled: true` and `payouts_enabled: true`
- If either is false, the smoke test can't verify the payout leg — pause here

### 3. Create the buyer account
- Sign up at `/signup` with buyer email
- Complete onboarding → choose **Buyer** role
- Add a real payment method when prompted (or defer until checkout)

### 4. Seller lists a $1–$5 item
- From the seller account: create a **buy-now** listing (not auction — faster to verify)
- Price: $1–$5
- Real title/description/photo (not "TEST")
- Publish

### 5. Buyer purchases with a real card
- Sign in as buyer, find the listing, click **Buy now**
- Complete Stripe Checkout with your real card

### 6. Backend verification (I run this)
Once you tell me the purchase went through, I'll verify in live data:
- `orders` row is `paid`, `stripe_payment_intent_id` populated
- `payments` row is `succeeded`
- `stripe_webhook_events` has the `checkout.session.completed` event, `processed = true`
- Listing status flipped to `sold`
- Pickup code generated on the order
- Conversation thread auto-created for the order
- Notifications fired to buyer + seller
- Payout row created for seller with correct fee math (10% buyer fee already collected, 10% seller commission deducted)

### 7. Refund
- From admin console (`/app/admin/orders/:id`), issue a full refund
- I verify: `payment_refunds` row created, order status flipped, seller payout reversed/cancelled, buyer notified

### 8. Sign-off
If all 7 checks pass, Phase 2B is complete and we move to **Phase 2C** (short live auction end-to-end with the same two accounts) and then **Phase 2D** (24h monitoring).

## What you need from me before you start

Nothing — you can begin creating the two accounts now. Ping me:
- (a) once seller shows `charges_enabled: true` (before you list), and
- (b) immediately after the buyer completes checkout,
and I'll run the verification queries.

## Fallback if Stripe Connect KYC gets stuck

If Stripe holds the seller account for manual review (can happen on brand-new accounts), we have two options:
- Wait it out (usually <24h)
- Use `nickraffmgmt@gmail.com` (already admin) to create a seller org on the side and complete Connect from an established identity — slightly less clean but unblocks the smoke test same-day

Tell me which you prefer if we hit that.
