# Final Launch Readiness PR

## Summary

This branch hardens the launch-critical admin access and messaging paths for Offcutt Clearance Hub.

## Completed

- Added admin role grant/revoke RPCs restricted to existing admins.
- Documented one-time founder admin bootstrap SQL.
- Added a clear admin-blocked state for non-admin users.
- Added expected admin route aliases.
- Added `/app/admin/messages` and an admin sidebar entry for conversation inspection.
- Added canonical `ensure_conversation` RPC for buyer/seller/admin conversation creation.
- Added transaction-level locking to reduce duplicate conversation races.
- Updated listing enquiry, order messaging and order message buttons to use the shared conversation resolver.
- Hardened the payment webhook to upsert order conversations and avoid duplicate order-confirmed system messages.
- Improved message inbox/thread/order-message loading, empty, error and send states.
- Added messaging integrity diagnostics and launch checklist counters.
- Replaced default Lovable metadata with Offcutt launch metadata.
- Added launch-readiness docs for admin access, backend control, messaging, deployment and QA.

## Migration Added

- `supabase/migrations/20260628010000_final_launch_admin_messaging_control.sql`

## Tests Run

- `npm run test` - passed.
- Added final-launch migration regression test for valid `order_status` enum usage.
- Added payment-webhook regression coverage for idempotent order conversation creation and pickup-safe chat wording.
- `npm run build` - passed.
- `./node_modules/.bin/tsc --noEmit` - passed.
- Targeted ESLint on changed source files - passed with warnings only.
- `npm run lint` - failed on existing repo-wide lint debt outside this pass.

## Routes Checked Locally

- `/`
- `/marketplace`
- `/terms`
- `/privacy`
- `/prohibited-materials`
- `/pickup-safety`
- `/refunds-and-disputes`
- `/auction-terms`
- `/buyer-default-policy`
- `/prohibited-bidding-policy`
- `/login`
- `/app/messages` unauthenticated redirect
- `/app/admin/launch-checklist` unauthenticated redirect
- `/app/admin/messages` unauthenticated redirect

## Remaining Blockers

- Founder/admin role must be bootstrapped in Supabase.
- Migration must be applied before deployed messaging/admin QA.
- Buyer/seller messaging must be manually QA tested against deployed branch.
- Live payments must not be enabled until owner approval and webhook QA.
- Legal review is required before public launch.
- Email delivery and production monitoring are not proven.

## Launch Recommendation

Internal testing ready after migration apply and founder admin bootstrap. Closed beta only after buyer/seller/admin messaging, payment and payout QA pass on the deployed environment. Not public launch ready.
