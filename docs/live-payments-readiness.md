# Live Payments Readiness

Updated: 2026-07-01

## Recommended Rollout

Use live buyer payments with manual seller payouts first.

Do not enable automated Stripe Connect seller payouts until Connect onboarding, transfer QA, dispute/refund handling and reconciliation have passed in sandbox.

## Current Implementation Status

Implemented:

- `payments-webhook` is the canonical payment webhook for the current payment architecture.
- `stripe_webhook_events` records processed webhook event ids for idempotency.
- `create-checkout` blocks live checkout unless `ENABLE_LIVE_PAYMENTS=true`.
- Bidder card setup, bidder card confirmation and auction deposit holds resolve payment mode from `auction_deposit_settings.current_gateway_mode`.
- Bidder card setup, bidder card confirmation and auction deposit holds block live Stripe unless `ENABLE_LIVE_PAYMENTS=true`.
- Auction winner charging uses the same guarded payment environment resolver.
- Automatic seller transfer remains blocked unless `ENABLE_AUTOMATED_PAYOUTS=true`.
- Admin refund and seller transfer actions have backend guardrails.
- Admin launch checklist no longer claims buyer/seller/admin/auction journeys are fully proven until sandbox QA evidence exists.

Not confirmed yet:

- Lovable has applied every migration and deployed every function in the target staging/live backend.
- Stripe sandbox webhook endpoint is configured only to `payments-webhook?env=sandbox`.
- Scheduled auction closer is running every 1-5 minutes.
- Full sandbox payment, auction, refund and payout QA has passed.

## Required Lovable / Supabase Configuration

Use this prompt in Lovable:

```text
Apply the latest GitHub main branch for Offcutt. Deploy all Supabase migrations and edge functions. Configure sandbox Stripe only. Register payments-webhook?env=sandbox as the only checkout webhook endpoint. Do not configure legacy stripe-webhook. Add a scheduled job for close-expired-auctions every 1-5 minutes. Keep ENABLE_LIVE_PAYMENTS and ENABLE_AUTOMATED_PAYOUTS disabled until sandbox QA is complete.
```

Deploy these edge functions:

- `create-checkout`
- `payments-webhook`
- `close-expired-auctions`
- `charge-auction-winner`
- `admin-refund-payment`
- `admin-create-seller-transfer`
- `bootstrap-founder-admin`
- `create-bidder-setup-intent`
- `confirm-bidder-payment-method`
- `authorize-bid-deposit`

Sandbox secrets:

- `STRIPE_SANDBOX_API_KEY`
- `PAYMENTS_SANDBOX_WEBHOOK_SECRET`
- `LOVABLE_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_PAYMENTS_CLIENT_TOKEN` using a Stripe test publishable key
- `ADMIN_BOOTSTRAP_TOKEN` temporarily, only until founder/admin QA access is confirmed
- `FOUNDER_ADMIN_EMAILS` with comma-separated founder/admin QA emails

Do not configure `STRIPE_LIVE_API_KEY`, `PAYMENTS_LIVE_WEBHOOK_SECRET` or `ENABLE_LIVE_PAYMENTS=true` until sandbox QA passes.

After admin access is confirmed, disable or rotate `ADMIN_BOOTSTRAP_TOKEN`.

## Sandbox QA Checklist

Record screenshots or notes for each item.

- Buy-now checkout success creates a `paid` order.
- Checkout cancellation cancels the pending order and releases the listing.
- Failed payment records `payments.status=failed` and does not leave the listing sold/buyable incorrectly.
- Webhook updates order/payment status from Stripe events, not from client-only state.
- `stripe_webhook_events` records processed events.
- Paid listing becomes `sold` and is hidden/disabled from marketplace buy actions.
- Paid order has a pickup code.
- Paid order creates/reuses buyer-seller conversation with the order-confirmed system message.
- Buyer can propose pickup.
- Seller can confirm pickup code.
- Admin can view payment/payout.
- Admin can put payout on hold.
- Admin can mark manual payout paid.
- Admin can resolve an issue.
- Admin launch checklist shows zero paid orders missing pickup code.
- Admin launch checklist shows zero sold listings still buyable/payment integrity issues.
- Bidder without saved card cannot bid.
- Bidder with saved card and accepted terms can bid.
- Seller and seller organisation members cannot bid on their own listing.
- Auction closer creates winner order.
- Auction winner saved-card charge succeeds in sandbox.
- Failed auction winner card triggers defaulted-winner handling and admin visibility.
- Admin refund succeeds in sandbox and puts payout on hold.
- Automatic transfer button remains blocked while `ENABLE_AUTOMATED_PAYOUTS` is false.

## Live Buyer Payments Switch

Only after the sandbox checklist passes:

1. Activate the Stripe live account.
2. Confirm business details, bank account, statement descriptor, GST/tax settings, support email and compliance checks.
3. Add `STRIPE_LIVE_API_KEY`.
4. Add `PAYMENTS_LIVE_WEBHOOK_SECRET`.
5. Register live Stripe webhook endpoint to `payments-webhook?env=live`.
6. Replace `VITE_PAYMENTS_CLIENT_TOKEN` with the live publishable key.
7. Set `ENABLE_LIVE_PAYMENTS=true`.
8. Keep `ENABLE_AUTOMATED_PAYOUTS` unset or false.
9. Keep real-money auctions controlled or disabled until auction winner charge handling is live-smoke-tested.
10. Remove fake listings, fake sellers, QA copy and test auctions.
11. Create 2-3 controlled real listings from known sellers.
12. Run one live low-value fixed-price smoke purchase.
13. Confirm webhook, order, pickup code, conversation, listing sold state and admin payout hold.

## Manual Seller Payout Process

Seller payouts remain manual for the first live rollout:

1. Admin reviews the paid order.
2. Admin confirms pickup/collection status.
3. Admin checks no open issue or refund risk exists.
4. Admin pays seller off-platform.
5. Admin marks manual payout paid with a reference note.

Do not enable `ENABLE_AUTOMATED_PAYOUTS=true` until:

- Stripe Connect live onboarding is complete.
- At least one sandbox seller transfer succeeds.
- Uncollected order blocks transfer.
- Open issue blocks transfer.
- Failed payment blocks transfer.
- Already transferred order blocks duplicate transfer.
- Seller payout reconciliation is documented against Stripe dashboard records.

## Go / No-Go Position

Current recommendation: not ready to switch live until sandbox QA is proven in the deployed Lovable backend.

Safe next milestone: closed sandbox QA using the current Lovable preview and Stripe test cards.

Safe first live milestone after QA: fixed-price buy-now listings only, with manual seller payouts and admin monitoring.
