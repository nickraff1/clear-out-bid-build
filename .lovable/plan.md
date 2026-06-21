
# Offcutt Launch Build — All Stages

Extends the existing schema (clearance_events + lots + bids + orders + payments + org_members) rather than refactoring. Preserves current frontend; wires it to real data and adds missing surfaces.

## Stage 1 — Backend additions

New tables (RLS + GRANTs in same migration, security-definer helpers reused):

- `reviews` — reviewer_id, reviewee_id, order_id, role ('buyer'|'seller'), rating 1–5, comment, created_at. RLS: participants of the order can insert; public can read.
- `messages` — conversation_id, sender_id, recipient_id, lot_id, body, read_at. RLS: only sender/recipient.
- `conversations` — buyer_id, seller_id, lot_id, last_message_at, unique(buyer_id, seller_id, lot_id).
- `lot_reports` — lot_id, reporter_id, reason, status. Admin-only read.
- `saved_search_alerts` — saved_search_id, lot_id, sent_at (for de-dup).
- `bulk_imports` — seller_org_id, file_url, status, rows_total, rows_ok, rows_error, error_json.
- `bulk_import_rows` — import_id, row_index, payload jsonb, status, error.
- `analytics_events` — user_id, event_name, props jsonb, created_at (insert-only by authenticated; admin read).
- `fee_settings` — singleton row {buyer_fee_pct, seller_fee_pct, updated_by, updated_at}. Admin write; all read. Seeded 0.05 / 0.05.
- `seller_badges` — org_id, badge ('verified'|'founding'), granted_at. Admin write.
- Extend `lots`: add `reserve_met boolean`, `buy_now_price numeric`, `min_bid_increment numeric`, `status` already supports reserved/expired via enum extension.
- Extend `organizations`: add `bio`, `website`, `rating_avg`, `rating_count`, `is_founding`, `is_verified`.
- Extend `profiles`: add `bio`, `avatar_url` (exists).
- Stripe Connect fields: `seller_stripe_accounts` already exists. Add `stripe_account_status`, `payouts_enabled`, `details_submitted`. Add `payments.stripe_session_id`, `payments.stripe_payment_intent`, `payments.platform_fee_buyer`, `platform_fee_seller`.

Security: keep existing RLS pattern (security-definer `has_role`, `is_org_member`, `has_order_for_event`). New policies follow same approach. Hide exact `site_address` from `clearance_events_public` view until buyer has paid order.

## Stage 2 — Core marketplace wiring

- `src/pages/Marketplace.tsx`: real Supabase query with filters (search text, category, suburb, state, price min/max, condition, pricing_type). URL-state filters.
- `src/pages/LotDetail.tsx`: full lot view, gallery, seller card with rating/badges, watchlist toggle, bid/buy actions, message-seller button. Address hidden until paid.
- Seller flows: existing CreateEvent/CreateLot extended with statuses (draft/active/reserved/sold/expired). Edit/delete pages added.
- Seed ~40 Sydney listings via `supabase--insert` (stone, timber, tile, metal, mixed; suburbs: Alexandria, Marrickville, Parramatta, Chatswood, Bondi, Penrith, etc.). Mix of fixed-price and auctions.

## Stage 3 — Auctions

- Bid modal with min-increment validation, confirmation.
- `auction-engine` edge function (exists) extended: place_bid (rate-limited, increment check, soft-close +2min if bid in last 60s), close_auction (sets reserve_met, creates order for winner, marks unsold otherwise).
- pg_cron job runs close_auction every minute for ended auctions (best-effort; documented if unavailable).
- Bid history visible on lot detail.

## Stage 4 — Stripe Connect (scaffold)

- Edge functions (scaffolded, marked `// TODO: add STRIPE_SECRET_KEY`):
  - `stripe-connect-onboard` — creates Express account link.
  - `stripe-checkout` — creates Checkout Session with `payment_intent_data.application_fee_amount` (buyer fee 5%) and `transfer_data.destination = seller_stripe_account`.
  - `stripe-webhook` — handles `checkout.session.completed`, `account.updated`, `payout.*`; updates `payments` + `orders`.
- Frontend: Checkout page calls `stripe-checkout`; seller PaymentSettings shows Connect onboarding state.
- Fee model reads `fee_settings`. Admin can edit.
- Clear in-app banner: "Add STRIPE_SECRET_KEY in Backend → Secrets to go live."

## Stage 5 — Messaging

- `/app/messages` inbox, conversation thread view. Realtime via Supabase channels.
- "Message seller" button on lot detail with quick-prompt chips ("Is this still available?", "Can I pick up tomorrow?", "Will you split the lot?").
- Address remains masked until order paid.

## Stage 6 — Reviews & trust

- After order status = `collected`, both parties prompted to review (1–5 stars + text).
- Seller profile shows rating_avg, badges, review list.
- "Report listing" button → `lot_reports`.
- Prohibited-materials checkbox required on CreateLot ("I confirm this lot contains no asbestos, lead paint, or hazardous waste").

## Stage 7 — Saved searches & alerts

- Save current filter set from Marketplace.
- `/app/buyer/alerts` dashboard.
- pg_cron job (hourly) matches new active lots against saved searches → inserts `notifications` + (if email enabled) enqueues email via existing edge function pattern. Scaffolded with TODO if email infra not yet set up.

## Stage 8 — Bulk upload

- `/app/seller/bulk-upload`: CSV template download, drag-drop upload to `lot-photos` bucket subpath, parse client-side via PapaParse, preview grid, "Publish all" → creates lots in batch.
- `bulk_imports` row tracks progress; row-level errors shown.

## Stage 9 — SEO landing pages

Public routes (Layout + hero + intro copy + filtered marketplace embed):

- `/sell-surplus-building-materials-sydney`
- `/buy-cheap-building-materials-sydney`
- `/construction-waste-marketplace-sydney`
- `/stone-offcuts-sydney`
- `/timber-offcuts-sydney`
- `/tile-offcuts-sydney`
- `/metal-offcuts-sydney`

Each: unique `<title>`, meta description, H1, JSON-LD (`ItemList` + `LocalBusiness`), canonical, OG tags. Sydney-specific copy.

## Stage 10 — Admin analytics

- `/app/admin/analytics`: cards + charts (Recharts).
  - Total users, active sellers/buyers (30d), active listings, completed transactions, GMV, platform fees (sum of `payments.platform_fee_*`), top categories, top suburbs, auction conversion %, buy-now conversion %, saved search count.
  - Sustainability: `estimated_kg_diverted` = SUM(lot.quantity * category.kg_per_unit) for sold lots; `estimated_buyer_savings` = SUM(retail_estimate - sale_price). Add `kg_per_unit` to categories and `retail_estimate` to lots.

## Stage 11 — Full admin dashboard

- `/app/admin/users`, `/sellers`, `/listings`, `/reports`, `/categories`, `/fees`, `/orders`, `/payments`, `/bids`, `/reviews`.
- Actions: approve/remove listing, ban listing, feature listing (`lots.is_featured`), grant badges, edit fee_settings, resolve reports.

## Technical notes

- All new tables: explicit GRANTs (`authenticated`, `service_role`; `anon` only on public-read tables like `reviews`, `fee_settings`, `analytics_events.insert`).
- All policies use existing security-definer helpers to avoid recursion.
- Frontend: new pages under `src/pages/app/{buyer,seller,admin}/` and `src/pages/seo/`; routes added in `src/App.tsx`.
- No `dangerouslySetInnerHTML`; zod validation on all forms; URL-encode outbound params.
- Stripe code paths fall back to a clear error if `STRIPE_SECRET_KEY` is unset, so the UI remains usable in scaffold mode.

## What you'll need to do after build

1. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Backend → Secrets.
2. Set the webhook endpoint URL in your Stripe dashboard (URL shown in PaymentSettings after build).
3. (Optional) Enable email domain for alert emails — I'll scaffold the function either way.

## Realistic expectations

This is a very large pass. I'll get the schema, RLS, routes, and primary flows wired end-to-end, but expect a follow-up round to polish edge cases (especially Stripe webhook testing, pg_cron timing, and bulk-upload error handling) once you've added Stripe keys and exercised the flows.
