# Messaging Audit

## Architecture

Tables:

- `conversations`
- `messages`
- `notifications`
- linked context: `lots`, `orders`, `organizations`, `profiles`

Routes/components:

- `/app/messages`: `MessagesInbox`
- `/app/messages/:id`: `MessageThread`
- Listing detail enquiry: `MessageSellerDialog`
- Order page messaging: `OrderMessages`
- Order page message button: `OrderDetail.openConversation`

## RLS summary

Conversation/message visibility is based on:

- buyer: `conversations.buyer_id = auth.uid()`
- seller: `public.is_org_member(auth.uid(), conversations.seller_org_id)`
- admin: `public.is_admin(auth.uid())`

Messages are inserted only by authenticated conversation participants.

## Bugs found and fixed

- Hand-rolled conversation creation existed in several components.
- Some paths ignored creation/select errors and could navigate without a usable conversation.
- Admin could not reliably inspect all conversations/messages for diagnostics.
- Inbox and thread error states were weak.
- "No messages" could be ambiguous when a query failed.

Fixes in this branch:

- Added `public.ensure_conversation(...)`.
- Added a transaction-level advisory lock inside `ensure_conversation` to reduce duplicate conversation creation under concurrent buyer/seller actions.
- `ensure_conversation` now seeds the order-confirmed system message when it repairs or creates a paid-order conversation missing that specific system message, even if the thread already has enquiry chat history.
- Listing enquiry now uses the RPC before inserting a message.
- Order detail message button now uses the RPC and shows errors.
- Order messaging widget now uses the RPC and shows errors.
- Admin can inspect conversations/messages through RLS-aware policies.
- Added `public.admin_messaging_integrity` diagnostic view.
- Launch checklist now reports messaging integrity issues and paid orders missing conversations.
- Inbox/thread/order-message UI now distinguishes loading, error, empty, and not-found states.
- Conversation threads now show a clearer "Conversation unavailable" recovery state with retry, back-to-messages, and admin diagnostics actions instead of a bare not-found message.
- Message thread and order-message sends append the inserted message immediately so users are not dependent on realtime latency to see their own message.

## Remaining limitations

- No one-click admin conversation repair UI yet.
- No end-to-end automated browser test for buyer-to-seller messaging yet.
- Email notifications are not proven live.
- Historical paid orders without conversations are repaired when a participant/admin opens the order conversation; other historical message gaps may still need admin review.

## Manual QA checklist

1. Buyer messages seller from listing detail.
2. Seller sees message in inbox.
3. Seller replies.
4. Buyer sees reply.
5. Buyer purchases listing in test payment mode.
6. Order conversation is created or reused.
7. System message appears.
8. Buyer messages seller from order page.
9. Seller messages buyer from order page.
10. Admin can identify the conversation.
11. Empty inbox shows only after loading completes.
12. Unrelated user cannot view the conversation.
