# Payment Launch Plan

Updated: 2026-07-01

## Implemented In This Pass

Single payment architecture:

- `payments-webhook` is now the canonical webhook for the built-in/manual-payout payment path.
- `stripe_webhook_events` records Stripe event ids so duplicate webhook deliveries are ignored safely.
- The older `stripe-webhook` should be treated as legacy and should not be configured for beta/live payments.

Bidder card verification:

- `can_user_bid` now hard-requires:
  - a verified bidder row
  - accepted current auction terms
  - saved Stripe customer and payment method
  - no restricted/banned status
  - no unpaid auction default
  - any required deposit hold

Auction winner payment flow:

- `close-expired-auctions` still closes expired auctions through the SQL closer.
- When a winner order is created, it now attempts an off-session charge against the winning bidder's saved card.
- Successful winner charge completes the order through the same shared paid-order helper as checkout webhook success.
- Failed winner charge marks the payment failed, stores the auction payment error, and runs the defaulted-winner flow.

Refunds:

- `admin-refund-payment` creates a Stripe refund, records a `payment_refunds` row, updates payment refund state, puts payout on hold, and updates the order state.
- Live refunds are blocked unless `ENABLE_LIVE_PAYMENTS=true`.

Seller payouts:

- `admin-create-seller-transfer` is implemented for Stripe Connect transfers.
- It is deliberately disabled unless `ENABLE_AUTOMATED_PAYOUTS=true`.
- It requires:
  - admin user
  - succeeded payment
  - collected order
  - no open issue
  - seller Stripe account with payouts enabled
  - no existing transfer id
- Until enabled, manual payout remains the beta default.

Admin visibility:

- Admin payouts page has guarded Refund and Transfer actions.
- Admin launch checklist now surfaces:
  - failed Stripe webhook events
  - payment/payout integrity issues
  - auction winner auto-charge failures
  - expired auction backlog without claiming a schedule exists

## Required Secrets

Sandbox QA:

- `STRIPE_SANDBOX_API_KEY`
- `PAYMENTS_SANDBOX_WEBHOOK_SECRET`
- `LOVABLE_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- frontend `VITE_PAYMENTS_CLIENT_TOKEN` with Stripe test publishable key

Live mode, only after explicit owner approval:

- `STRIPE_LIVE_API_KEY`
- `PAYMENTS_LIVE_WEBHOOK_SECRET`
- `ENABLE_LIVE_PAYMENTS=true`

Automated seller payouts, only after payout QA and owner approval:

- `ENABLE_AUTOMATED_PAYOUTS=true`

## Lovable / Supabase Dashboard Tasks

Prompt Lovable or configure manually:

```text
Configure Offcutt payment backend for sandbox QA only. Deploy the latest Supabase edge functions, apply all migrations, set sandbox Stripe secrets, and configure the Stripe webhook endpoint to call payments-webhook?env=sandbox. Do not configure the legacy stripe-webhook endpoint. Do not enable live payments.
```

Schedule prompt:

```text
Add a scheduled job for the close-expired-auctions edge function to run every 1-5 minutes in the sandbox/staging environment. The function should close ended auctions and trigger the saved-card winner charge flow. Do not enable live payment mode.
```

Seller payout prompt for later, after sandbox QA:

```text
Prepare Stripe Connect seller onboarding and payout QA in sandbox. Keep ENABLE_AUTOMATED_PAYOUTS disabled until test sellers complete Connect onboarding, order collection is tested, open-issue holds are tested, and admin transfer reconciliation is verified.
```

## Minimum QA Before Leaving Beta

Buyer checkout:

1. Buy-now order creates pending payment.
2. Embedded checkout succeeds in sandbox.
3. Webhook marks payment succeeded.
4. Order becomes paid.
5. Pickup code is generated.
6. Listing becomes sold.
7. Conversation and system message are created.

Checkout failure:

1. Start checkout.
2. Expire/cancel/fail payment.
3. Webhook records event.
4. Payment is failed/cancelled.
5. Pending order is cancelled.
6. Listing reservation is released only if no successful payment exists.

Auction bidder:

1. User without saved card cannot bid.
2. User with saved card but no terms cannot bid.
3. User with terms/card can bid.
4. Seller cannot bid on own lot.
5. Restricted/banned bidder cannot bid.
6. Required deposit path works for configured tiers.

Auction winner:

1. Auction closes after end time.
2. Winner order is created.
3. Saved card is charged off-session in sandbox.
4. Successful charge marks order paid and listing sold.
5. Failed card marks payment failed and default flow runs.
6. Admin can identify the failure in launch checklist and bidder tools.

Refund:

1. Admin refunds a sandbox succeeded payment.
2. Refund row is recorded.
3. Payment refund fields update.
4. Payout is put on hold.
5. Order is cancelled or disputed according to refund amount.

Seller payout:

1. Manual payout remains default in beta.
2. Transfer action is blocked while `ENABLE_AUTOMATED_PAYOUTS` is not true.
3. In sandbox only, enable automatic payouts.
4. Seller Connect account is onboarded.
5. Collected order with no open issue transfers seller net payout.
6. Transfer id is stored.
7. Open issue blocks transfer.
8. Uncollected order blocks transfer.

## Launch Recommendation

Do not exit beta until:

- webhook ledger shows clean sandbox event processing
- auction winner card charge succeeds and fails predictably in sandbox
- refund path is proven in sandbox
- scheduler is proven
- founder/admin can view and fix failed payment states
- seller payout process is reconciled against Stripe dashboard
- legal terms cover binding bids, defaulted winners, refunds, disputes and seller payout timing
