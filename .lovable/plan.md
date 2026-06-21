## Audit: Spec vs current Offcutt implementation

Legend: ✅ implemented · 🟡 partial / deviation · ❌ missing

### 1) Role-based app shell
- ✅ `/app` redirect by role (`AppRedirect.tsx`)
- ✅ Portals `/app/buyer/*`, `/app/seller/*`, `/app/admin/*`
- ✅ RBAC via `RoleGuard.tsx` + `localStorage` fallback for fresh onboarding

### 2) Seller portal
- ✅ Overview, events list, event detail, lots manager, lot create/edit
- 🟡 **Event creation is a single form, not a 3-step wizard** (`CreateEvent.tsx`). Site-constraint fields (forklift, dock, pickup hours) are folded into a single `access_notes` text field — no structured constraints.
- ✅ Lot create: category, title, qty/unit, condition, photos, compliance tags, fixed/auction pricing, draft/live
- ✅ Lots belong to seller org (enforced by RLS + `is_org_member`)
- 🟡 Event detail shows lots + add-lot deep link, but the **consolidated pickup schedule lives on a separate `/app/seller/pickups` page**, not embedded in the event page

### 3) Buyer portal
- ✅ Overview, bids, orders, watchlist, alerts pages all exist
- 🟡 **`BuyerOrders` filters by `buyer_id` only, not `buyer_org_id`** (`BuyerOrders.tsx:54`). Spec explicitly requires org-scoped visibility so org staff see org orders. Same issue likely on `BuyerOverview`/`BuyerBids` — needs re-check.
- ✅ Watchlist + saved searches + alerts tables exist
- 🟡 Email delivery for saved-search alerts: table + UI present, but no scheduled job sending emails was found

### 4) Auction engine
- ✅ Server-side bid validation, min-increment, end-time, self-bid block (`prevent_seller_self_bid` trigger)
- ✅ Auto-create order at close (`close_expired_auction` SECURITY DEFINER + `close-expired-auctions` cron)
- ✅ Immutable `bid_events` audit log
- 🟡 **Soft-close extension on last-minute bid: not found** in `auction-engine` or DB triggers — needs confirmation
- 🟡 **Per-user bid rate limit: not found**

### 5) Pickup scheduling & proof
- 🟡 Spec calls for a slot picker bound to event window. Current model uses a **free-form pickup-time proposal** between buyer and seller (`proposed_pickup_at`, `agreed_pickup_at`) plus a `pickup_code` handshake. `pickup_slots` table exists but isn't used by the buyer flow.
- ✅ Seller has consolidated pickup schedule (`SellerPickups.tsx`)
- 🟡 **Proof-of-pickup photo upload: `pickup_confirmations` table exists but no UI uploads to it.** Completion is done via pickup-code entry instead.

### 6) Onboarding
- ✅ `OnboardingWizard.tsx` runs on first login, picks role, creates org
- 🟡 **3-step checklist with deep-links to first action: not present.** Wizard ends at role/org creation, no post-onboarding "list your first item / place your first bid" checklist.

### 7) Design consistency
- ✅ Orange/black/white tokens, dashboard cards, status chips, mobile-first lot create
- ✅ Recent polish pass standardized empty states and status wording

---

### Post-order workflow audit

**Database (`orders` table)**
- ✅ buyer_id, buyer_org_id, lot_id, event_id, amount, status, pickup_status, pickup_code, admin_notes, proposed/agreed/collected timestamps
- ❌ `order_number` (human-readable)
- ❌ `seller_org_id` (derived via `lot → event → org_id` join; spec wants it denormalized)
- ❌ Separate `platform_fee` / `total_amount` columns (fee is encoded in `amount` and free-text `notes`)
- ❌ `order_items` table (single-lot orders only — fine for current model, but spec calls for it)
- ❌ `order_status_history` table — status transitions are not logged
- ❌ `payment_status` enum column (payment state lives in `payments` table instead)
- 🟡 Status enum: has `pending_payment / paid / ready_for_pickup / collected / cancelled / disputed`. Missing `PICKUP_SCHEDULED`. Pickup state is tracked separately in `pickup_status`.

**Order creation**
- ✅ Buy Now: creates order, reserves lot, redirects to checkout/order page
- ✅ Auction close: `close_expired_auction` creates order for winner with `pending_payment` + notification

**Buyer Orders page**
- 🟡 Live and shows orders (7 paid orders confirmed in DB for the active test buyer) — **so the reported "orders not appearing" bug is NOT reproducing**. Likely fixed in an earlier pass.
- 🟡 But query is `buyer_id = user.id`, **not `buyer_org_id IN user's orgs`** — org staff of the same buyer org won't see each other's orders. This is the only real gap vs the spec on this page.

**Order detail (`/app/orders/:id`)**
- ✅ Single shared page for buyer + seller, gated by role
- ✅ Pickup proposal/accept, pickup-code reveal, seller confirm
- ✅ Cancel order (admin), force-complete (admin), regenerate code (admin)
- ❌ Buyer proof-of-pickup photo upload
- 🟡 "Choose pickup slot" uses free-form datetime, not slot picker

**Seller**
- ✅ Event detail lists lots; seller orders + pickups pages exist
- 🟡 Per-event order list is not embedded in the event detail page

**Admin**
- ✅ AdminOrders with manual status actions, payout controls, notes

**RBAC / RLS**
- ✅ Orders RLS scopes buyers to own user + buyers org members; sellers to event-org members; admins all
- ✅ `protect_order_critical_fields` trigger locks amount/buyer/lot/pickup_code; restricts seller/buyer status transitions

---

### Net gaps if you later want spec-perfect

1. Buyer orders/bids/overview queries → use `buyer_org_id IN (user's orgs)` instead of `buyer_id`.
2. Add `order_status_history` table + trigger logging every status change.
3. Add `order_number`, denormalized `seller_org_id`, `platform_fee`, `total_amount`, `payment_status` columns (or accept current model).
4. Implement real `pickup_slots` selection flow + `pickup_confirmations` photo upload UI.
5. Add soft-close auction extension (e.g. last-60s bid pushes `auction_end` by 2 min) and bid rate-limit.
6. Convert event creation to 3-step wizard and add structured site-constraint fields (forklift/dock/hours).
7. Embed per-event order/pickup schedule inside seller event detail.
8. Onboarding: add post-role 3-step checklist with deep links to first listing / first bid.
9. Saved-search email delivery job.

**No code changes made — this is audit-only.** Tell me which of the gaps above (if any) you want me to fix and I'll plan that work next.