## Goal
Make the post-purchase journey usable end-to-end: once a buyer creates/pays for an order, it is clearly visible in the buyer portal, opens into a guided order page, and can be traced/admin-managed from the admin portal. Use the Offcut Sydney project as the UX reference while preserving the existing Offcutt backend model where possible.

## What I found
- Orders are being created and paid orders exist in the database.
- The likely visibility gap is in the buyer portal queries and navigation:
  - Buyer order pages currently filter by `buyer_id` only, even though the backend access model also supports `buyer_org_id`.
  - Checkout return sends buyers to the generic orders list instead of the specific order detail page.
  - Buyer overview recent orders are not strong “manage/arrange pickup” entry points.
- The order detail page has core pickup actions, but lacks the clearer Offcut Sydney-style post-purchase guidance: “what happens next”, pickup code emphasis, payment summary, and step-by-step status context.
- Admin can list orders, but tracing is mostly a flat table; it needs clearer search/status/payment/pickup diagnostics and direct drill-in for beta support.

## Implementation plan

### 1) Fix buyer order visibility
- Update buyer order fetches to include orders where the user is either:
  - the direct `buyer_id`, or
  - a member of the `buyer_org_id` through the existing backend/RLS access model.
- Apply this consistently to:
  - Buyer Orders page
  - Buyer Overview recent orders/stats
  - Any buyer order summaries that currently only use `buyer_id`
- Keep RLS intact; do not make orders public.

### 2) Improve post-checkout routing
- Change checkout success/return UX so a successful payment leads buyers directly to:
  - `/app/orders/:orderId`
- Keep secondary CTAs:
  - “View all orders”
  - “Keep browsing”
- If webhook confirmation is still pending, show a processing state with a retry/check-again path and a direct link to the pending order detail when possible.

### 3) Polish buyer post-purchase UI using Offcut Sydney as reference
- Rework the existing order detail page layout, not the backend flow:
  - Order header with item title, order number/short ID, buyer/seller context, status chips
  - Listing summary with image, seller/org, pickup suburb/address visibility rules
  - Clear “Next step” panel based on current status:
    - pending payment → pay now
    - paid / awaiting arrangement → propose pickup time or message seller
    - pickup proposed → accept/suggest another time
    - ready for pickup → show pickup code and collection instructions
    - collected → review/report completion state
  - Prominent pickup code section for buyers, seller confirmation instructions for sellers
  - Payment summary sidebar using existing order/payment fields
  - Issue reporting and messaging remain available from the order page

### 4) Make buyer orders page action-oriented
- Replace the passive table feel with clearer rows/cards inspired by Offcut Sydney:
  - item title
  - status + pickup status
  - payment/pickup next action
  - “Manage order” CTA
  - “Pay now” CTA for pending payment
- Preserve filters/search and existing design tokens.

### 5) Improve seller/admin traceability
- Seller orders/pickups:
  - Ensure seller rows link directly to the shared order detail page.
  - Show pickup status and next action wording consistently.
- Admin orders:
  - Keep the existing admin controls, but make order tracing clearer with: order short ID, buyer, seller, payment status, pickup status, missing-code/stuck indicators, direct “Open” action.
  - Add clearer empty/loading/error states so beta testers know whether no records exist vs. filters hiding records.

### 6) Add lightweight backend traceability if needed
- If current tables are insufficient during implementation, add a small `order_status_history` table and trigger so status changes are traceable in admin/order detail.
- This would include proper grants and RLS:
  - buyers can view history for their own org’s orders
  - sellers can view history for their own event/org orders
  - admins can view all
- I will only add this if needed for the “can’t be traced” admin requirement; otherwise I’ll reuse existing `orders`, `payments`, and `notifications` data.

### 7) Validate end-to-end
- Verify the current paid test orders appear in buyer portal queries.
- Check checkout return behavior routes to the specific order.
- Verify buyer, seller, and admin can all open the same order detail route according to their role.
- Check no new RLS errors, dead buttons, or confusing empty states are introduced.