# Final Launch Readiness Report

## Executive summary

Recommended status: **Closed beta ready after owner admin bootstrap and messaging/payment QA**.

The app is not public launch ready. It has enough structure for a controlled closed beta, but live payments, legal review, email delivery, monitoring, and complete mobile/end-to-end QA remain blockers.

## What was fixed in this pass

- Added secure admin role grant/revoke RPCs for existing admins.
- Documented one-time founder admin bootstrap SQL.
- Added admin access blocked state.
- Added admin route aliases for expected admin URLs.
- Added admin messaging visibility through RLS-aware policies.
- Added `ensure_conversation` RPC for buyer/seller/admin message creation.
- Updated listing/order messaging flows to use the RPC.
- Added transaction locking to conversation creation to reduce duplicate thread races.
- Added server-side reseeding of the order-confirmed system message when a paid-order conversation is created later from the order page.
- Updated message send flows to append the saved message immediately instead of waiting only for realtime.
- Hardened the payment webhook to upsert the order conversation, avoid duplicate order-confirmed system messages, and keep pickup-address wording out of chat.
- Improved inbox, thread and order-message loading/error/empty states.
- Added messaging integrity diagnostics view.
- Added launch checklist admin status and messaging integrity checks.
- Added launch docs for admin access, backend control, messaging audit, deployment readiness and QA.
- Replaced default Lovable app metadata with Offcutt launch metadata.

## Tests run

- Production build: passed.
- Vitest: passed, including final-launch regression coverage for migration `order_status` enum usage and payment-webhook order conversation messaging.
- TypeScript check: passed.
- Targeted lint on touched files: passed with warnings only.
- Full repo lint: failed on pre-existing lint debt outside this pass, mostly `@typescript-eslint/no-explicit-any`, shadcn empty-interface warnings, hook dependency warnings, and one Tailwind `require()` import.
- Local browser smoke: passed for `/`, `/marketplace`, policy pages, `/login`, `/app/messages`, and `/app/admin/launch-checklist`.
- Protected app routes redirect unauthenticated users to `/login`.

## Known remaining bugs/risks

- Need manual browser QA of the new `ensure_conversation` path after migration is applied.
- Need real buyer/seller account QA against the deployed branch because local browser QA cannot create live Supabase conversations without deployed migration state.
- Admin bootstrap requires Supabase/service-role SQL.
- Live payment mode is not enabled or approved.
- Email delivery is not proven.
- Full mobile QA is still required.
- Full RLS/security audit is still required before public launch.
- Auction bidder verification/deposit flow needs a dedicated end-to-end test.

## Beta blockers remaining

- Owner must grant/verify founder admin access.
- Run manual messaging QA with buyer and seller test accounts.
- Run test checkout success/failure/cancel/expiry QA.
- Confirm Supabase migrations apply cleanly in Lovable/Supabase environment.

## Public launch blockers remaining

- Legal review of terms, privacy, prohibited materials, pickup safety, refunds/disputes and auction policies.
- Live payment approval and full webhook QA.
- Seller payout operating procedure and reconciliation checklist.
- Email notification setup and deliverability checks.
- Production monitoring/error logging.
- Mobile QA on buyer, seller and admin flows.
- Documented support/dispute process.

## Payment mode assessment

The code supports test/live detection from the publishable payment token. Live payments must not be enabled until owner approval, webhook validation and payout process review are complete.

## Seller payout assessment

Seller payouts are manual during beta. The UI must continue to say manual payout, and admins must only mark payout paid after verifying successful buyer payment, pickup status and open issues.

## Auction integrity assessment

Auction protections exist, including seller/self-bid restrictions and admin bidder tools. Public launch of auctions should wait until bidder verification and auction close flows are proven with real test scenarios.

## Trust/safety assessment

Trust/safety pages and report reasons exist. These are beta-ready placeholders, not lawyer-approved public-launch documents.

## Recommended next 10 actions

1. Apply migrations and verify founder admin access.
2. QA buyer listing enquiry to seller reply.
3. QA order-created/reused conversation.
4. QA admin launch checklist as founder.
5. Run test payment success, cancel, expiry and failure.
6. QA seller payout hold/paid/failed controls.
7. QA auction bid, seller self-bid rejection and auction close.
8. Complete mobile QA.
9. Arrange legal review.
10. Configure production monitoring and email delivery before public launch.
