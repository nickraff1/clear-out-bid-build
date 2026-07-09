# Offcutt Email Coverage Matrix

Last updated: 2026-07-09

## Current Email Architecture

Offcutt now sends Supabase/Lovable auth emails through Resend:

- `auth-email-hook` verifies the Lovable/Supabase auth email webhook.
- It renders the auth email template.
- It enqueues the email into the `auth_emails` queue.
- `process-email-queue` sends queued emails through Resend using `RESEND_API_KEY`.
- Send attempts are recorded in `email_send_log`.

The backend also has infrastructure for marketplace transactional emails:

- `transactional_emails` queue exists.
- `email_send_log` exists.
- `notifications.email_should_send` exists.
- `process-email-queue` already processes `transactional_emails`.

However, most marketplace events currently create in-app notifications only. They are not yet reliably converted into transactional emails.

## Auth And Security Emails

| Event | Current status | Recommendation | Notes |
| --- | --- | --- | --- |
| Signup email confirmation | Covered | Required | Resend path confirmed by auth hook. |
| Password reset | Covered | Required | Recovery email has been confirmed sent through Resend. |
| Magic login link | Covered | Required if magic links remain enabled | Template exists. |
| User invite | Covered | Required if invites remain enabled | Template exists. |
| Email address change confirmation | Covered | Required | Template exists. |
| Reauthentication / verification code | Covered | Required | Template exists. |
| Password changed confirmation | Not explicitly covered | Required | Add an app-level security email after password update if Supabase does not emit a hook event for this. |
| Failed login warning | Not implemented | Owner decision | Useful later, but can be noisy and is not launch-critical. |
| New device/session login | Not implemented | Owner decision | Useful later for trust, but not launch-critical. |

## Buyer Transactional Emails

| Event | Current status | Recommendation | Priority |
| --- | --- | --- | --- |
| Payment successful / order confirmed | In-app only | Email required | P0 |
| Payment failed | In-app or backend state only | Email required | P0 |
| Auction won and card auto-charge succeeded | In-app only | Email required | P0 |
| Auction won but payment action required | In-app only | Email required | P0 |
| Manual payment deadline before next bidder is offered | Partly implemented in app state | Email required | P0 |
| Outbid | In-app only | Email required | P1 |
| Auction ending soon for watched/bid listings | Not clearly covered | Email required | P1 |
| Auction lost | Not clearly covered | Email required | P2 |
| Pickup time proposed by seller | In-app only | Email recommended | P1 |
| Pickup time accepted/confirmed | In-app only | Email required | P0 |
| Seller marked item ready for pickup | In-app only | Email required | P0 |
| Pickup completed / order completed | In-app only | Email required | P0 |
| Review unlocked/reminder | Not clearly covered | Email recommended | P2 |
| Refund started/processed | Admin/payment dependent | Email required | P0 |
| Dispute or payment review update | Admin/payment dependent | Email required | P0 |
| Issue/report received | In-app only | Email required | P0 |
| Issue/report resolved | In-app only | Email required | P0 |
| New buyer-seller message | In-app only | Email required immediately with message preview | P1 |
| Saved item/watchlist listing ending soon | In-app only | Email required | P2 |
| Saved item/watchlist price/status change | Not clearly covered | Email required | P2 |
| Saved item/watchlist listing sold/ended | Not clearly covered | Email required | P2 |

## Seller Transactional Emails

| Event | Current status | Recommendation | Priority |
| --- | --- | --- | --- |
| Item sold / buyer payment confirmed | In-app only | Email required | P0 |
| Buyer charged; payout timing notice | Not implemented | Email required | P0 |
| Seller listing published confirmation | Not clearly covered | Email required | P1 |
| New bid received on seller auction | Not clearly covered | Email required | P1 |
| Auction ended with winner | Not clearly covered | Email required | P0 |
| Auction ended reserve not met / unsold | Not clearly covered | Email required | P1 |
| Buyer payment failed on won auction | In-app/admin state only | Email recommended | P1 |
| Buyer proposed pickup time | In-app only | Email required | P0 |
| Buyer changed/cancelled pickup proposal | Not clearly covered | Email recommended | P1 |
| Buyer sent message | In-app only | Email required immediately with message preview | P1 |
| Buyer reported issue | In-app only | Email required | P0 |
| Pickup confirmed/completed | In-app only | Email required | P0 |
| Payout scheduled/processing | In-app only | Email required | P1 |
| Seller payout paid | In-app only | Email required | P0 |
| Seller payout failed | In-app only | Email required | P0 |
| Seller payout on hold | In-app only | Email required | P0 |
| Stripe Connect action required | App UI exists | Email required | P0 |
| Stripe Connect setup incomplete reminder | App UI exists | Email required | P0 |
| Stripe Connect payouts paused / action required | App state exists | Email required | P0 |
| Listing approved/featured/suspended | In-app/admin action dependent | Email recommended | P1 |

## Admin Transactional Emails

| Event | Current status | Recommendation | Priority |
| --- | --- | --- | --- |
| New paid order | In-app only | Email recommended | P1 |
| Payment failed / auction charge failed | In-app/admin state only | Email required | P0 |
| Stuck order detected | Launch checklist only | Email recommended | P1 |
| Report/issue opened | In-app only | Email required | P0 |
| Payout failed/on hold | In-app only | Email required | P0 |
| Seller Stripe Connect requirements past due | App state exists | Email recommended | P1 |
| Webhook failure / payment reconciliation issue | Partial logs only | Email required once detectable | P0 |
| Auction winner auto-charge failed | Partial logs only | Email required | P0 |
| Order paid but seller payout blocked | Admin/payout state only | Email required | P0 |
| New seller awaiting approval/onboarding | Not clearly covered | Email recommended | P1 |

## Current Gaps To Implement

1. Add a transactional notification email template.
2. Add a safe dispatcher that finds notifications marked `email_should_send = true`, renders an email, enqueues it to `transactional_emails`, and marks it queued/sent without duplicate sends.
3. Update high-priority backend event writers to set `email_should_send = true` for approved email events.
4. Add unsubscribe/suppression handling for non-auth emails.
5. Keep auth/security emails non-unsubscribable.
6. Add an admin email log page or admin diagnostics card showing sent, failed, suppressed, and dead-lettered emails.
7. Add manual QA steps for each email class before public launch.
8. Add per-user email preference controls for non-critical emails, while keeping auth, payment, order, safety, dispute, and payout emails mandatory.

## Recommended Launch Defaults

Send email for:

- Auth/security emails.
- Payment success and payment failure.
- Auction win, auction lost, outbid events, ending-soon reminders, and auction payment failure/action required.
- Order confirmed.
- Seller notice after buyer charge: payment has been collected and payout is expected within 24-48 hours after release checks pass.
- Seller listing published confirmation.
- Seller receives first bid.
- Pickup proposed, accepted, ready, and completed.
- Pickup reminder 24 hours before agreed time.
- Issue/report opened and resolved.
- Payout scheduled/processing, paid, failed, or on hold.
- Stripe Connect action required, onboarding incomplete, and payouts paused/action required.
- Buyer/seller messages immediately with message preview text.
- Watchlist/listing alerts for ending soon, sold/ended, and material changes.

Use in-app only for:

- Routine dashboard reminders.
- Listing drafts/edits.
- Low-priority admin analytics.

Owner decisions now confirmed:

- Every new buyer/seller message sends an email immediately.
- Message emails include a preview of the message body.
- Every outbid event sends an email.
- Auction-lost emails are enabled.
- Listing/watchlist alert emails are enabled.
- Additional launch emails approved: seller listing published confirmation, seller first-bid notice, auction ending soon for bidders/watchers, buyer payment receipt, pickup reminder 24 hours before agreed time, seller buyer-charged payout-timing notice, seller Stripe onboarding incomplete, seller Stripe payouts paused/action required, payout scheduled/processing, and payout paid with transfer reference.

## Additional Marketplace Emails To Add

These are useful for a marketplace like Offcutt and align with common auction/resale marketplace behaviour:

| Event | Recipient | Why it matters | Priority |
| --- | --- | --- | --- |
| Seller listing published | Seller | Confirms the listing is live and gives seller a link to inspect it. | P2 |
| Listing rejected/suspended/removed | Seller | Trust and safety action must be clearly communicated. | P1 |
| Seller receives first bid | Seller | Encourages seller engagement and confirms auction traction. | P2 |
| Auction ending soon | Current bidders/watchers | Drives final bids and reduces abandoned auctions. | P1 |
| Buyer payment receipt | Buyer | Provides receipt-like confirmation for audit/support. | P0 |
| Seller sale confirmation with payout timeline | Seller | Confirms buyer was charged and explains expected payout timing. | P0 |
| Pickup reminder 24 hours before agreed time | Buyer and seller | Reduces no-shows. | P1 |
| Pickup missed / no-show action required | Buyer and seller | Keeps collection workflow moving. | P1 |
| Pickup code viewed/reminder | Buyer | Reduces confusion at collection. | P2 |
| Refund requested/approved/processed | Buyer and seller | Payment transparency and dispute handling. | P0 |
| Admin forced order status change | Buyer and seller where relevant | Prevents confusion after support intervention. | P1 |
| Seller Stripe onboarding incomplete | Seller | Prevents payout delays before real sales happen. | P0 |
| Seller Stripe payouts paused/action required | Seller and admin | Prevents surprise blocked payouts. | P0 |
| Payout scheduled/processing | Seller | Bridges gap between collection and money arriving. | P1 |
| Payout paid with transfer reference | Seller | Clear financial record. | P0 |
| Account role/admin/security change | Affected user/admin | Security audit trail. | P0 |

## Approved Launch Email Scope

The following additional emails are explicitly approved for implementation in the launch email pass:

- Buyer/seller message email immediately, including message preview text.
- Seller listing published confirmation.
- Seller receives first bid.
- Auction ending soon for bidders/watchers.
- Buyer payment receipt.
- Pickup reminder 24 hours before agreed time.
- Seller sale confirmation: buyer has been charged; payout expected within 24-48 hours after release checks pass.
- Seller Stripe onboarding incomplete.
- Seller Stripe payouts paused/action required.
- Payout scheduled/processing.
- Payout paid with transfer reference.

## Suggested Lovable Prompt

Use this after the owner confirms which events should send emails:

```text
Implement Offcutt transactional emails through the existing Resend queue architecture. Do not change auth email handling. Use auth-email-hook and process-email-queue as the existing pattern.

Add a generic transactional notification email template and a safe backend dispatcher for notifications where email_should_send = true. The dispatcher must enqueue into transactional_emails, prevent duplicate sends, respect suppressed_emails for non-auth emails, and update notification/email log state.

Enable email_should_send only for the approved high-priority events:
- buyer payment successful / order confirmed
- payment failed
- auction won
- auction lost
- outbid
- auction ending soon
- auction payment action required
- manual auction payment deadline
- buyer payment receipt
- item sold / seller payment received
- seller buyer-charged payout timing notice: payment collected, payout expected within 24-48 hours after release checks pass
- seller listing published confirmation
- seller new bid received
- seller auction ended with winner
- seller auction ended reserve not met / unsold
- pickup proposed
- pickup confirmed
- item ready for pickup
- pickup completed / order completed
- pickup reminder
- pickup reminder 24 hours before agreed time
- missed pickup/no-show action required
- issue/report opened
- issue/report resolved
- refund requested/approved/processed
- payout paid
- payout paid with transfer reference
- payout failed
- payout on hold
- payout scheduled/processing
- Stripe Connect action required
- Stripe Connect onboarding incomplete reminder
- Stripe Connect payouts paused/action required
- buyer/seller message immediately with preview text
- watchlist/listing alerts for ending soon, sold/ended, and price/status changes

Keep auth/security, payment, order, pickup, dispute, safety, and payout emails non-unsubscribable. Allow future preference controls for marketing/watchlist/message-style emails, but default them on for launch. Do not email routine listing drafts/edits or admin analytics. Do not expose secrets and do not alter payment success logic.
```
