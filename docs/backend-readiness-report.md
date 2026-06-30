# Backend Readiness Report

Audit date: 2026-06-30

Scope: repository-backed audit of the Lovable Cloud / Supabase-style backend for Offcutt Clearance Hub. This report is based on the checked-in `supabase/` migrations, edge functions, generated database types, app usage, and existing launch-readiness docs. Lovable project status was checked through the connector and is `ready` on the synced preview build. The connector does not expose the live database catalog, so live schema/RLS/secret/scheduler status still needs dashboard verification.

## Executive Summary

Recommended backend status: **internal testing ready; closed beta only after live migration/secret/scheduler verification**.

The backend is substantial and mostly shaped like a real marketplace backend: RLS is enabled across core tables, roles are represented in `user_roles`, seller/buyer access is represented through `org_members`, admin access is enforced through security-definer RPCs and policies, payments are tracked separately from orders, and messaging has explicit conversation/message policies.

The largest launch risks are operational rather than architectural:

- The live Lovable database must be proven to have all migrations applied, especially the final admin/messaging migration.
- Admin founder bootstrap must be completed with service-role SQL before admin pages can be fully QA tested.
- Only one payment webhook path should be configured for beta. The newer `payments-webhook` matches manual payout mode and now includes a webhook event ledger; the older `stripe-webhook` should be treated as legacy unless intentionally used.
- Auction closing requires an external schedule or manual admin action. The repo contains the closer function, but no committed Supabase cron declaration was found.
- Storage policy is broad: authenticated users can upload to `lot-photos`; application-side ownership must stay correct, and bucket policy should be reviewed before public launch.
- External Supabase migration readiness is moderate, but must be tested against a clean Supabase project before cutting away from Lovable.

## Backend Inventory

### Tables

Core marketplace tables:

- `profiles`
- `organizations`
- `org_members`
- `user_roles`
- `categories`
- `compliance_tags`
- `clearance_events`
- `lots`
- `lot_media`
- `lot_compliance_tags`
- `watchlist`
- `saved_searches`
- `saved_search_alerts`

Transaction and operations tables:

- `orders`
- `payments`
- `pickup_slots`
- `pickup_confirmations`
- `reviews`
- `lot_reports`
- `notifications`
- `admin_audit_logs`
- `analytics_events`
- `bulk_imports`
- `bulk_import_rows`
- `seller_badges`
- `seller_stripe_accounts`
- `stripe_webhook_events`
- `payment_refunds`

Auction and bidder tables:

- `bids`
- `bid_events`
- `bidder_verifications`
- `auction_deposit_settings`
- `auction_deposits`
- `bidder_audit_log`

Messaging tables:

- `conversations`
- `messages`

Diagnostic views:

- `admin_stuck_orders`
- `admin_messaging_integrity`
- `clearance_events_public`
- `lot_bid_stats`

Assessment: **working but needs live verification**. The schema supports the intended marketplace, but the live cloud schema must be compared against the repo migrations before beta.

## RLS Policy Readiness

RLS is enabled on core tables in the initial migration and on later tables such as bidder verification, auction deposits, fee settings, reports, and messaging. The policy model is broadly sensible:

- Public read: active listings/events, categories, compliance tags, lot media, selected public views.
- User read/write: own profile, own notifications, own watchlist, own saved searches.
- Org member access: seller org members manage events/lots/media/tags and can view seller-side order context.
- Buyer access: buyers can see their own orders and ordered listing/event context.
- Admin access: `public.is_admin(auth.uid())` is used throughout admin policies and RPCs.
- Messaging access: buyer, seller org member, or admin can see relevant conversations and messages.

Important concerns:

- `profiles` originally allowed broad public select. Later migrations add narrower profile policies, but the exact final policy set must be inspected in the live database to ensure there are no duplicate permissive policies still active.
- `bids` originally allowed public select. That may be acceptable for auction transparency, but public bidder identity exposure should be reviewed.
- `notifications` has an insert policy with `WITH CHECK (true)` from early migrations. Triggers and service role use this legitimately, but authenticated clients should not be able to create arbitrary notifications if the policy applies broadly in the live final state.
- `pickup_slots` are publicly readable. That is acceptable for pickup windows, but exact pickup address lives on `clearance_events`; event policies must continue to protect full address where needed.

Assessment: **closed-beta acceptable after live policy catalog review**. Do not call this public-launch ready until the live policies are listed and checked for duplicated permissive rules.

## Admin Access And Role Enforcement

Admin access source of truth:

- `user_roles.role = 'admin'`
- `public.has_role(_user_id, _role)`
- `public.is_admin(_user_id)`
- frontend `AuthContext` loads roles and route guards enforce admin screens client-side
- backend policies/RPCs enforce admin server-side

Admin bootstrap:

- Existing admins can grant/revoke roles by email through:
  - `public.admin_grant_user_role(_email, _role)`
  - `public.admin_revoke_user_role(_email, _role)`
- First-admin bootstrap still requires service-role SQL, documented in `docs/admin-access.md`.

Admin operational RPCs present:

- `admin_regenerate_pickup_code`
- `admin_force_complete_order`
- `admin_cancel_order`
- `admin_add_order_note`
- `admin_set_payout_status`
- `admin_resolve_report`
- `admin_set_org_verified`
- `admin_set_org_founding`
- `admin_set_org_disabled`
- `admin_set_bidder_status`
- `admin_remove_bid`

Assessment: **architecturally sound, operationally unverified**. The design does not make every user admin and does not rely only on frontend route hiding. The founder account must be bootstrapped and every admin route must be live-tested after migration apply.

## Edge Functions

Configured in `supabase/config.toml`:

- `auction-engine` with `verify_jwt = false`
- `stripe-webhook` with `verify_jwt = false`
- `create-checkout` with `verify_jwt = false`
- `payments-webhook` with `verify_jwt = false`

Additional functions present:

- `close-expired-auctions`
- `cancel-pending-order`
- `stripe-checkout`
- `stripe-connect-onboard`
- `create-bidder-setup-intent`
- `confirm-bidder-payment-method`
- `authorize-bid-deposit`
- `_shared/stripe.ts`

Readiness notes:

- Public/no-JWT functions that are webhooks or scheduled jobs are expected, but they must authenticate internally through Stripe signatures, bearer token checks, or service-role-only operations.
- `create-checkout` validates the caller token through Supabase Admin, checks order ownership, requires pending payment, and writes a payment row.
- `payments-webhook` verifies the Stripe webhook, handles success/failure/cancel/expiry, updates order/payment status, marks lots sold, and creates/reuses order conversations.
- `stripe-webhook` is older and simpler. It should not be configured alongside `payments-webhook` unless there is a clear reason, because duplicate webhook paths increase risk of inconsistent order/payment behavior.
- `close-expired-auctions` uses service role and calls the database closer RPC. It has no request authentication because it is intended for scheduled/manual invocation; if exposed publicly, rate limiting or a shared secret would be safer before public launch.

Assessment: **working but needs deployment verification**. Confirm every function is deployed in Lovable Cloud and later in external Supabase, and confirm secrets exist only in backend secrets.

## Storage Buckets

The migrations create a `lot-photos` bucket:

- public bucket
- 10 MB file limit
- image MIME types only
- public read policy
- authenticated upload policy scoped to bucket
- authenticated update/delete policy scoped by object owner

Assessment: **closed-beta usable, public-launch needs review**. Public images are appropriate for marketplace listings. Before public launch, confirm:

- Upload paths are application-generated and not user-controlled in a way that causes collisions.
- Users cannot overwrite another seller's listing photos through shared paths.
- Bucket policies exist in the live project after migration.
- Any future private documents, IDs, invoices, or dispute files use a separate private bucket.

## Payments And Webhooks

Payment mode represented in schema:

- `payment_mode`: `manual_payout_mode` or `stripe_connect_mode`
- `manual_payout_status`: manual payout lifecycle
- `payments` tracks base amount, buyer fee, seller fee, seller payout, amount charged, Stripe session/payment intent, environment, payout status, notes, and error state.

Current safest beta path:

- `create-checkout`
- `payments-webhook?env=sandbox`
- manual seller payout tracking

Webhook coverage in the newer handler:

- `checkout.session.completed`
- `payment_intent.payment_failed`
- `checkout.session.expired`
- `checkout.session.async_payment_failed`
- `payment_intent.canceled`

Positive controls:

- Stripe event ids are recorded in `stripe_webhook_events`; duplicate events are ignored.
- Order is only moved from `pending_payment` to `paid`.
- Pickup code is generated on payment success.
- Lot is marked sold after payment success.
- Failed/expired/cancelled sessions cancel pending orders and release reservations through DB triggers if no succeeded payment exists.
- Order-confirmed conversation/system message is created or reused.

Risks:

- `stripe-webhook` and `payments-webhook` overlap conceptually. Configure one beta webhook path only.
- Webhook idempotency is now explicitly ledgered in code/migrations, but still needs Stripe sandbox event QA.
- Live payments must not be enabled until sandbox webhook tests pass with real Stripe test events.
- Stripe Connect transfer support exists behind `ENABLE_AUTOMATED_PAYOUTS=true`, but seller payout automation must remain disabled until Connect onboarding, transfers, disputes, refunds, and payout reconciliation are proven.

Assessment: **sandbox/manual-payout beta ready after webhook QA; automatic payout ready for sandbox/staging only; not live-payment ready**.

## Auction Cron And Integrity

Auction controls present:

- `can_user_bid`
- `enforce_bidder_eligibility` trigger
- `prevent_seller_self_bid` trigger
- pickup-window bid guard
- `accept_auction_terms`
- bidder verification tables
- bidder status admin RPCs
- deposit setting/deposit tracking scaffolding
- soft-close logic in `auction-engine`
- `close_expired_auction`
- `close_all_expired_auctions`
- `close-expired-auctions` edge function
- saved-card winner charge after auction close

Cron status:

- No committed `pg_cron` schedule or Supabase schedule declaration was found.
- `close-expired-auctions` is available for manual/admin or external scheduled invocation.

Risks:

- Auctions rely on an external schedule to close automatically; the function now charges the winning bidder after close, but the scheduler still must be configured in Lovable/Supabase.
- Bidder payment method enforcement is still soft in `can_user_bid` unless deposit settings require it.
- Deposit/authorization functions exist, but auction deposits are not proven enough for public real-money auctions.
- `auction-engine` contains a manual close path separate from the SQL closer. The SQL closer should be treated as canonical unless QA proves both paths behave identically.

Assessment: **closed-beta with controlled auctions only after sandbox winner-charge QA; public auctions blocked until scheduled closer, failed-card handling, and bidder payment verification are proven**.

## Messaging Permissions

Messaging backend:

- `conversations`
- `messages`
- `public.ensure_conversation`
- `public.is_conversation_participant`
- `admin_messaging_integrity`

Access rules:

- Buyer can view/send in their conversations.
- Seller org members can view/send in their conversations.
- Admins can inspect conversations and messages.
- Participants can insert messages only as themselves.
- System messages are inserted through trusted flows/RPCs.

Recent hardening:

- Shared conversation resolver reduces duplicate conversations.
- Advisory lock reduces race conditions.
- Order-confirmed system message is seeded for paid orders.
- Admin diagnostics detect empty conversations, missing buyer/seller/listing/order context, and paid orders missing system messages.

Known live QA result:

- The previous schema-cache bug caused by attempting a non-existent `conversations -> profiles` relationship was fixed and live-tested on the Lovable preview.

Assessment: **closed-beta ready after one more buyer/seller/admin live QA pass**. Admin messaging inspection still depends on founder admin bootstrap.

## Order Lifecycle

Supported states:

- `pending_payment`
- `paid`
- `ready_for_pickup`
- `collected`
- `cancelled`
- `disputed`

Important lifecycle controls:

- Pending-payment reservations can be released.
- Payment success marks order paid, generates pickup code, and marks lot sold.
- Payment failure/cancel/expiry cancels pending order if no succeeded payment exists.
- Pickup proposal is validated.
- Admin can regenerate pickup code, cancel, force complete, add notes.
- Payout status is blocked from paid if payment is not succeeded.
- Admin diagnostic view detects stuck orders.

Risks:

- `admin_cancel_order` disables user triggers internally, then manually releases lot reservation. That is intentional but deserves extra QA because trigger disabling is sharp-edged.
- Refund state appears in some checks, but `order_status` enum does not include `refunded`. The migration tests protect against introducing invalid enum updates, but product-level refund handling remains incomplete.
- There is no dedicated order status history table.

Assessment: **closed-beta usable with admin supervision; public launch needs refund/dispute history hardening**.

## Migration Health

Observed migration posture:

- 25 migration files are present.
- Initial schema uses direct `CREATE TYPE` / `CREATE TABLE`; later migrations use a mix of `ALTER`, `CREATE OR REPLACE`, and `IF NOT EXISTS`.
- Generated types include all expected core tables, views, functions, and enums.
- Regression tests exist for final launch migration issues.
- `npm run test` passes: 2 test files, 6 tests.

Concerns:

- There are duplicate/replaced functions across migrations. This is normal in iterative Lovable projects, but clean external migration must be tested from an empty database.
- Some migrations assume prior objects exist. External migration should be done by replaying all migrations in timestamp order, not by cherry-picking late files.
- The live Lovable database may have drift from checked-in migrations. Schema diff is required before external migration.
- Secrets are not part of migrations and must be separately configured.
- Edge function deployment and schedule configuration are not guaranteed by database migrations alone.

Assessment: **migration chain likely usable, but not proven portable until clean Supabase replay passes**.

## External Supabase Migration Readiness

Before moving off Lovable Cloud, complete this checklist:

1. Create a fresh Supabase project for staging.
2. Apply every migration in `supabase/migrations` in timestamp order.
3. Regenerate Supabase types and compare with `src/integrations/supabase/types.ts`.
4. Deploy all edge functions.
5. Add secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` or publishable key
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY` / sandbox and live variants used by `_shared/stripe.ts`
   - `STRIPE_WEBHOOK_SECRET` / sandbox and live variants used by `_shared/stripe.ts`
6. Configure only the intended checkout/webhook path for beta.
7. Configure Stripe webhook endpoint for `payments-webhook?env=sandbox`; do not configure legacy `stripe-webhook`.
8. Configure scheduled invocation for `close-expired-auctions`.
9. Verify `lot-photos` bucket and policies.
10. Bootstrap founder admin with service-role SQL.
11. Run buyer/seller/admin smoke QA on staging.
12. Only after staging passes, switch frontend Supabase environment variables.

Readiness assessment: **moderate**. The codebase is ready to attempt a staging migration. It is not ready to cut production away from Lovable until staging replay, functions, secrets, webhook events, and cron are proven.

## High-Priority Backend Blockers

1. Founder admin not proven bootstrapped in live backend.
2. Live database migration state not independently verified.
3. Auction closer schedule not committed/proven.
4. Payment webhook setup not proven with Stripe sandbox events.
5. Duplicate legacy/current Stripe webhook functions could be misconfigured.
6. Public-launch auction bidder payment/deposit/winner-charge enforcement not proven.
7. Live RLS policy catalog needs review for permissive duplicates.
8. Storage bucket policy needs live review before public upload volume.

## Recommended Next Backend Actions

1. Verify Lovable live migration state against the repo.
2. Bootstrap founder admin and QA `/app/admin/*`.
3. In Lovable/Supabase dashboard, list active RLS policies for `profiles`, `notifications`, `bids`, `conversations`, `messages`, `orders`, and `payments`.
4. Decide and document the single beta payment path: recommended `create-checkout` plus `payments-webhook`.
5. Configure Stripe sandbox webhook events and run a full checkout success/failure/expiry test.
6. Add or configure a scheduled job for `close-expired-auctions`.
7. Create a clean external Supabase staging project and replay migrations.
8. Deploy all edge functions to staging and run function smoke tests.
9. Confirm `lot-photos` bucket and object ownership behavior.
10. Run the refund and automatic seller transfer paths in sandbox before enabling either in live.

## Final Backend Readiness Rating

Internal testing ready: **yes**.

Closed beta ready: **not yet, but close**. It becomes closed-beta ready after founder admin bootstrap, live migration/RLS verification, Stripe sandbox webhook QA, and auction closer scheduling.

Limited live beta ready: **no**. Live payments, payout process, scheduler, and dispute/refund handling are not proven.

Public launch ready: **no**. Public launch requires legal review, live payment verification, stronger observability, proven auction controls, and production-grade operational recovery.
