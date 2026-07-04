
-- Purge all pre-existing test/seed lots, events, and their child records so the
-- live-mode marketplace starts empty. Real accounts will populate it.

-- Seed org IDs and QA orgs to fully remove
WITH test_orgs AS (
  SELECT id FROM organizations
  WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
  )
),
-- All existing lots are pre-live test data
all_lot_ids AS (SELECT id FROM lots),
all_event_ids AS (SELECT id FROM clearance_events),
all_order_ids AS (SELECT id FROM orders)

-- Wipe child rows first
DELETE FROM pickup_confirmations WHERE order_id IN (SELECT id FROM all_order_ids);
DELETE FROM payment_refunds WHERE order_id IN (SELECT id FROM orders);
DELETE FROM payments WHERE order_id IN (SELECT id FROM orders);
DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations);
DELETE FROM conversations;
DELETE FROM reviews;
DELETE FROM notifications;
DELETE FROM watchlist;
DELETE FROM bid_events;
DELETE FROM bids;
DELETE FROM auction_deposits;
DELETE FROM lot_reports;
DELETE FROM lot_compliance_tags;
DELETE FROM lot_media;
DELETE FROM orders;
DELETE FROM pickup_slots;
DELETE FROM lots;
DELETE FROM clearance_events;
DELETE FROM bulk_import_rows;
DELETE FROM bulk_imports;
DELETE FROM saved_search_alerts;

-- Remove seed test orgs entirely (Sydney Construction Co / Melbourne / Brisbane)
DELETE FROM org_members WHERE org_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);
DELETE FROM seller_stripe_accounts WHERE org_id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);
DELETE FROM organizations WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- Clear all sandbox webhook events so the audit log starts fresh for live
DELETE FROM stripe_webhook_events;
