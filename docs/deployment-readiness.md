# Deployment Readiness

## Framework

- Vite
- React
- TypeScript
- Supabase/Lovable backend
- Stripe/Lovable payment functions

## Commands

Install:

```sh
npm install
```

Build:

```sh
npm run build
```

Tests:

```sh
npm run test
```

Lint:

```sh
npm run lint
```

## Required environment variables

Do not commit real values.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_PAYMENTS_CLIENT_TOKEN`

Server/edge function secrets expected by payment functions:

- Supabase service role key
- Stripe secret key or Lovable payment secret equivalent
- Stripe webhook signing secret

## Payment mode

The app detects payment mode from `VITE_PAYMENTS_CLIENT_TOKEN`:

- `pk_test_...`: sandbox/test mode
- `pk_live_...`: live mode
- missing: payments not configured

Do not switch to live payments without owner approval.

## Webhooks and scheduled jobs

Webhook functions:

- `stripe-webhook`
- `payments-webhook`

Scheduled/operational functions:

- `close-expired-auctions`
- `auction-engine`

Before live beta:

1. Confirm webhook endpoints are registered.
2. Confirm checkout success, failure, cancel and expiry events update orders/payments.
3. Confirm expired auctions are closed on schedule.
4. Confirm payment webhooks are idempotent enough for duplicate events.

## Domain/auth redirects

Before inviting users:

- configure production domain
- configure auth redirect URLs
- configure checkout return/cancel URLs
- verify reset-password links

## Storage/photo upload

Photo upload exists, but storage bucket policy should be checked in Supabase before live launch:

- sellers can upload listing images
- public can view approved listing images
- unrelated users cannot overwrite/delete seller media

## Rollback

1. Keep the last known-good GitHub commit SHA.
2. Revert or redeploy prior build from GitHub/Lovable.
3. Do not roll back database migrations destructively without a reviewed down plan.
4. For payment incidents, disable live checkout before data changes.

## Known deployment gaps

- No production monitoring tool is configured in repo.
- No automated database backup/export process documented outside Supabase defaults.
- Email delivery status is not proven.
- Legal pages need legal review before public launch.
