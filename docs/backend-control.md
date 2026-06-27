# Backend Control

## Admin control pages

- `/app/admin/overview`: operational overview and stuck-state counters
- `/app/admin/launch`: launch checklist and close-expired-auctions action
- `/app/admin/orders`: order control, pickup code regeneration, force-complete, cancel, admin notes
- `/app/admin/payouts`: manual payout review and status changes
- `/app/admin/reports`: listing/order report review and resolution
- `/app/admin/messages`: admin conversation inspection using the shared inbox view
- `/app/admin/listings`: listing moderation surface
- `/app/admin/users`: user/profile/role visibility
- `/app/admin/sellers`: seller organisation verification, founding badge, suspension
- `/app/admin/bidders`: bidder status controls, suspicious bid removal
- `/app/admin/fees`: buyer/seller fee settings
- `/app/admin/notifications`: admin view of notifications

## Admin RPCs/functions

- `public.is_admin`
- `public.admin_grant_user_role`
- `public.admin_revoke_user_role`
- `public.admin_regenerate_pickup_code`
- `public.admin_force_complete_order`
- `public.admin_cancel_order`
- `public.admin_add_order_note`
- `public.admin_set_payout_status`
- `public.admin_resolve_report`
- `public.admin_set_org_verified`
- `public.admin_set_org_founding`
- `public.admin_set_org_disabled`
- `public.admin_set_bidder_status`
- `public.admin_remove_bid`
- `public.ensure_conversation`

Edge functions:

- `close-expired-auctions`
- `auction-engine`
- `create-checkout`
- `stripe-checkout`
- `stripe-webhook`
- `payments-webhook`
- `cancel-pending-order`
- bidder payment method functions

## Stuck-state checks

Currently surfaced:

- expired auctions still active
- paid orders missing pickup code
- paid orders missing conversation
- pending payment orders older than 30 minutes
- pickup proposed in the past
- payout overdue
- open issue reports
- active listings with expired pickup windows
- active listings without category
- messaging integrity issues
- conversations without messages
- paid-order conversations missing the order-confirmed system message

## Manual recovery procedures

Order missing pickup code:

1. Open `/app/admin/orders`.
2. Use regenerate pickup code.
3. Add an admin note.
4. Notify buyer/seller if needed.

Paid order missing conversation:

1. Open the order detail as admin.
2. Use the message action or `public.ensure_conversation`.
3. Confirm buyer and seller can see `/app/messages/:id`.
4. Add admin note to the order.

Paid order conversation missing system message:

1. Open the order detail as admin.
2. Use the message action or `public.ensure_conversation`.
3. Confirm the thread includes: "Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed."
4. Add an admin note if the conversation needed manual review.

Payout issue:

1. Open `/app/admin/payouts`.
2. Confirm payment status is `succeeded`.
3. Check pickup status and reports.
4. Put payout on hold if there is an issue.
5. Mark paid only after manual bank transfer.

Seller issue:

1. Open `/app/admin/sellers`.
2. Suspend organisation if needed.
3. Review seller listings and orders.
4. Resolve reports before reactivation.

Auction issue:

1. Open `/app/admin/bidders`.
2. Review bid history/risk indicators.
3. Restrict/ban bidder or remove suspicious bid with note.
4. Use close expired auctions from launch checklist when needed.

## Known unsupported operations

- No full admin conversation repair wizard.
- No automated seller bank payouts.
- No full email delivery dashboard.
- No integrated legal-case management for disputes.
- No production monitoring integration beyond app/admin checks.
