
# Launch-Readiness Audit — Offcutt Closed Beta

I audited every flow you listed. Here's what's broken, what's polish, and exactly what I'll fix. **The fee bug (P0 #1) is financially consequential — buyers are being charged 5% instead of 10%, and the platform is under-collecting on every transaction.** Nothing should go live until that's fixed.

---

## P0 — Blockers (must fix before real money)

| # | Issue | Files | Fix |
|---|---|---|---|
| 1 | **Buyer fee is 5%, not 10%** — order totals, displayed math, and `application_fee_amount` are all wrong | `src/pages/app/buyer/Checkout.tsx:78,118`, `supabase/functions/create-checkout/index.ts:3,74` | Change divisor to `1.10`, label to "Buyer fee (10%)", server fee math to 10%, update stale comment |
| 2 | Raw order-status enum (`pending_payment`, `ready_for_pickup`) shown to buyers | `src/pages/app/orders/OrderDetail.tsx:256` | Use the existing `lib/order-status.ts` label map for the status badge |
| 3 | Raw `pickup_status` enum (`collected_pending_seller_confirmation`) shown to buyers | `src/pages/app/buyer/BuyerOrders.tsx:179` | Add `PICKUP_STATUS_LABELS` to `lib/order-status.ts` and use it |
| 4 | Client-side order cancel is racy | `src/pages/app/buyer/CheckoutCancel.tsx:17–23` | Move cancel to an edge function (`cancel-pending-order`) that releases the lot reservation atomically |

## P1 — Polish (do before closed beta opens)

| # | Issue | Files | Fix |
|---|---|---|---|
| 5 | "Lot" jargon in buyer/seller table headers and buttons | `BuyerBids.tsx:158`, `SellerLots.tsx:178`, `SellerEvents.tsx:221,274`, `EventDetail.tsx:184,258,267,319,327,335` | Replace with "Listing" / "Add listing" / "Edit listing" / "Publish listing" / "Cancel listing" |
| 6 | "This item is reserved" / "Lot not found" leak internal model | `LotDetail.tsx:362,406` | "Listing not found"; "Currently in checkout with another buyer" |
| 7 | "Set up bidding account" copy is odd | `LotDetail.tsx:589–594` | "Verify your details to start bidding" |
| 8 | Stale fee comment in checkout function | `supabase/functions/create-checkout/index.ts:3` | Update to 10% |
| 9 | Unit option "Lot" in CreateLot quantity-unit dropdown | `CreateLot.tsx:443` | Rename to "Whole job lot" (kept value `lot` for DB compat) |
| 10 | Verify payout-status row is gated to sellers only | `OrderDetail.tsx:530–537` | Confirm `isSeller` wrapper; tighten if leaking |

## Confirmed working (no change)

- All 8 policy pages routed correctly (`/terms`, `/privacy`, `/prohibited-materials`, `/pickup-safety`, `/refunds-and-disputes`, `/auction-terms`, `/buyer-default-policy`, `/prohibited-bidding-policy`)
- Outbid notifications fire from `auction-engine`
- Winner order creation uses correct 10% buyer fee (server-side); only the buy-now path was wrong
- Pickup code generated on successful payment
- Bid form correctly hidden on ended / sold / reserved / own lots
- Admin RPCs wired: `sweep_defaulted_winners`, `mark_deposit_outcome`, `offer_to_next_bidder`, `relist_auction`, `admin_regenerate_pickup_code`, `admin_force_complete_order`
- CheckoutReturn polls with sensible fallback
- `admin_remove_bid` exists in DB but has no UI — I'll add a "Remove bid" action in the lot's bid history on `AdminBidders` / lot detail admin view

## Out of scope for this pass

- Visual redesign (per your instruction)
- New features beyond fixing what's audited
- Stripe go-live (separate workflow)
- Mobile QA beyond CSS overflow spot-checks — full device QA stays with you

---

## Execution plan

**Step 1 — P0 fixes (single commit)**
- Fix fee math + label in `Checkout.tsx` and `create-checkout` edge function
- Extend `lib/order-status.ts` with `ORDER_STATUS_LABELS` + `PICKUP_STATUS_LABELS` and apply in `OrderDetail.tsx` and `BuyerOrders.tsx`
- New `cancel-pending-order` edge function; rewrite `CheckoutCancel.tsx` to call it

**Step 2 — P1 copy + jargon sweep**
- Find/replace "Lot" → "Listing" across buyer/seller pages listed (admin pages untouched)
- Reword "reserved" / "bidding account" / "Lot not found" strings
- Verify mobile layout on listing detail, bid sidebar, checkout iframe, order detail by reading the JSX (no redesign)

**Step 3 — Admin `admin_remove_bid` wiring**
- Add a "Remove bid" button to the bid history table in `AdminBidders` drawer with confirm dialog and audit note

**Step 4 — Update Launch Checklist (`AdminLaunch.tsx`)**
Add new checks and refresh statuses:

| Check | Status |
|---|---|
| Buyer journey (browse → buy → order → pickup → review) | **PASS** after P0 #1–3 |
| Seller journey (create → publish → sell → pickup → payout) | **PASS** after P1 #5 |
| Admin journey (orders, payouts, reports, bidders) | **PASS** after Step 3 |
| Auction journey (verify → bid → close → winner order) | **PASS** (already wired) |
| Payment states (success, fail, expired, cancel, stuck) | **PASS** after P0 #1 + #4 |
| Policy pages | **PASS** (all 8 live) |
| Mobile marketplace / listing creation | **PASS** (spot-check, no fixed widths found) |
| Closed-beta readiness | **PASS** when above all green AND Stripe go-live complete |

**No new database migrations needed** — only one new edge function (`cancel-pending-order`) and one frontend label helper.

---

Reply **approve** and I'll execute Steps 1–4 in order, ending with an updated Launch Checklist screenshot. Or tell me to drop/reorder any item.
