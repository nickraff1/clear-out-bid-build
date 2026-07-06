# Stripe Connect Readiness

Offcutt keeps automatic seller payouts enabled as a target capability, but each seller organisation now has an explicit Stripe Connect readiness state.

## Seller States

- `ready`: card payments, payouts and transfers are enabled.
- `payout_setup_incomplete`: the seller still needs to finish onboarding.
- `review_pending`: Stripe has information under review.
- `action_required`: Stripe requires seller/admin action.
- `payments_paused`: Stripe has paused card payments.
- `payouts_paused`: Stripe has paused payouts or transfers.
- `not_started`: no connected Stripe account exists yet.

## Stored Stripe Fields

`seller_stripe_accounts` stores:

- Stripe account ID
- charges enabled
- payouts enabled
- card payments capability
- transfers capability
- requirements currently due
- requirements past due
- requirements pending verification
- disabled reason
- last synced timestamp
- last onboarding link timestamp
- admin notes

## Seller Flow

Sellers use `/app/seller/payments` to:

- view their payout readiness status
- see Stripe requirements that need action
- continue Stripe onboarding
- refresh their Stripe status after submitting information

This is the path sellers should use for issues like missing business website, missing representative, missing external account, or unaccepted Stripe terms.

## Admin Flow

Admins use:

- `/app/admin/sellers` to see each seller organisation's Stripe readiness, refresh Stripe status, and open/copy onboarding links
- `/app/admin/payouts` to see whether a pending payout is blocked by Stripe readiness

Automatic Stripe transfers are blocked when the seller is not `ready`. The transfer helper also blocks if the order is not collected, an open issue exists, the payment did not succeed, or a transfer already exists.

## Stripe Webhooks

The payment webhook updates seller readiness from:

- `account.updated`
- `capability.updated`
- `person.updated`
- `account.external_account.created`
- `account.external_account.updated`
- `account.external_account.deleted`

Stripe webhook endpoints should include those Connect events in both sandbox and live once Connect payouts are enabled.

## Live Operations Note

Do not treat a seller as payout-ready because they have merely created a Stripe account. They are payout-ready only when Offcutt shows `Ready for payouts` and transfers capability is active.
