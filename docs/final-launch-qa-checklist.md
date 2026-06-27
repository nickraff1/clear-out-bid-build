# Final Launch QA Checklist

## Buyer

1. Sign up and log in.
2. Browse `/marketplace`.
3. Filter by category and buy type.
4. Open listing detail.
5. Message seller.
6. Save and unsave listing.
7. Start buy-now checkout in test mode.
8. Complete successful test checkout.
9. Confirm order appears in buyer dashboard.
10. Confirm exact pickup address is hidden before payment and visible after payment.
11. Propose pickup time.
12. View pickup code.
13. Mark collected.
14. Leave review after completion.
15. Report issue.

## Seller

1. Sign up/login.
2. Create seller organisation.
3. Create clearance event.
4. Create listing.
5. Upload photo.
6. Save draft.
7. Publish listing.
8. Receive buyer message.
9. Reply to buyer.
10. View sold order.
11. See payment status.
12. See gross, fee and net payout.
13. Coordinate pickup.
14. Confirm pickup code.
15. See manual payout status.
16. Report issue if needed.

## Messaging

1. Buyer sends listing enquiry.
2. Seller sees inbox row.
3. Seller opens thread.
4. Seller replies.
5. Buyer sees reply.
6. Order page message button opens same/reused thread.
7. Empty inbox appears only after fetch completes.
8. Admin launch checklist shows no messaging integrity issues.

## Auction

1. Buyer accepts auction terms.
2. Buyer has bidder/payment method status where required.
3. Seller cannot bid on own listing.
4. Bid below increment is rejected.
5. Expired auction rejects bids.
6. Soft-close extension works if bid is near end.
7. Close expired auction creates correct winner/order or unsold status.
8. Admin can inspect and remove suspicious bid with note.

## Admin

1. Admin opens `/app/admin`.
2. Admin launch checklist loads.
3. Admin can view users.
4. Admin can view listings.
5. Admin can view orders.
6. Admin can regenerate pickup code.
7. Admin can force-complete with note.
8. Admin can cancel with note.
9. Admin can resolve report.
10. Admin can put payout on hold.
11. Admin can mark payout paid only after checking payment and pickup status.
12. Admin can inspect bidder tools.

## Mobile

1. Marketplace cards fit at phone width.
2. Filters are usable.
3. Listing detail bid/report/message controls are reachable.
4. Create listing form is usable.
5. Messages thread input is reachable.
6. Order detail actions are reachable.
7. Admin checklist is readable enough for emergency use.
