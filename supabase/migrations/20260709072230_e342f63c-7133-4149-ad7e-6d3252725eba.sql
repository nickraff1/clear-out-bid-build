-- Transactional email dispatch support for Resend-backed notifications.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_error text,
  ADD COLUMN IF NOT EXISTS email_message_id text,
  ADD COLUMN IF NOT EXISTS email_template_name text;

CREATE INDEX IF NOT EXISTS idx_notifications_email_dispatch_pending
  ON public.notifications(created_at)
  WHERE email_should_send = true
    AND email_queued_at IS NULL
    AND email_sent_at IS NULL;

DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq', 'rate_limited'));
END $$;

CREATE OR REPLACE FUNCTION public.notification_type_should_email(_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path=public
AS $$
  SELECT _type = ANY(ARRAY[
    'order_paid','payment_successful','payment_failed','auction_won','auction_lost',
    'auction_payment_action_required','auction_payment_deadline','auction_ending_soon',
    'outbid','watchlist_listing_ending_soon','watchlist_listing_updated','watchlist_listing_sold',
    'new_sale','order_sold','seller_buyer_charged_payout_timing','listing_published',
    'seller_first_bid','seller_auction_won','seller_auction_unsold','pickup_proposed',
    'pickup_agreed','ready_for_pickup','pickup_reminder','pickup_missed','order_collected',
    'refund_requested','refund_processed','dispute_update','report_received','report_resolved',
    'admin_report','new_message','payout_scheduled','payout_processing','payout_paid',
    'payout_failed','payout_on_hold','stripe_connect_action_required',
    'stripe_connect_onboarding_incomplete','stripe_connect_payouts_paused'
  ]);
$$;

CREATE OR REPLACE FUNCTION public.notifications_set_email_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF public.notification_type_should_email(NEW.type) THEN
    NEW.email_should_send := true;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notifications_set_email_flag ON public.notifications;
CREATE TRIGGER trg_notifications_set_email_flag
BEFORE INSERT OR UPDATE OF type ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notifications_set_email_flag();

CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid, _type text, _title text, _message text,
  _link_url text DEFAULT NULL,
  _order_id uuid DEFAULT NULL, _lot_id uuid DEFAULT NULL,
  _conversation_id uuid DEFAULT NULL, _report_id uuid DEFAULT NULL,
  _email boolean DEFAULT false, _priority text DEFAULT 'normal'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE nid uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.notifications(user_id, type, title, message, link_url,
    related_order_id, related_lot_id, related_conversation_id, related_report_id,
    email_should_send, priority, data)
  VALUES (_user_id, _type, _title, _message, _link_url,
    _order_id, _lot_id, _conversation_id, _report_id,
    (_email OR public.notification_type_should_email(_type)), _priority, '{}'::jsonb)
  RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.notify_on_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  c record; lot_title text; preview text;
BEGIN
  IF NEW.is_system THEN RETURN NEW; END IF;
  SELECT buyer_id, seller_org_id, lot_id, order_id INTO c
    FROM public.conversations WHERE id=NEW.conversation_id;
  SELECT title INTO lot_title FROM public.lots WHERE id=c.lot_id;
  preview := left(regexp_replace(COALESCE(NEW.body, ''), '\s+', ' ', 'g'), 280);
  IF NEW.sender_id = c.buyer_id THEN
    PERFORM public.notify_org(c.seller_org_id, 'new_message', 'New message from buyer',
      CASE WHEN preview <> '' THEN preview ELSE COALESCE('Re: '||lot_title, 'You have a new message') END,
      '/app/messages/'||NEW.conversation_id, c.order_id, c.lot_id, NEW.conversation_id, 'normal');
  ELSE
    PERFORM public.notify_user(c.buyer_id, 'new_message', 'New message from seller',
      CASE WHEN preview <> '' THEN preview ELSE COALESCE('Re: '||lot_title, 'You have a new message') END,
      '/app/messages/'||NEW.conversation_id, c.order_id, c.lot_id, NEW.conversation_id, NULL, true, 'normal');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_messages_notify ON public.messages;
CREATE TRIGGER trg_messages_notify AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

CREATE OR REPLACE FUNCTION public.notify_on_bid() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prev record; lot_title text; seller_org uuid; previous_bid_count integer;
BEGIN
  SELECT l.title, ce.org_id INTO lot_title, seller_org
    FROM public.lots l JOIN public.clearance_events ce ON ce.id = l.event_id
    WHERE l.id=NEW.lot_id;
  SELECT count(*) INTO previous_bid_count FROM public.bids WHERE lot_id=NEW.lot_id AND id <> NEW.id;
  IF previous_bid_count = 0 THEN
    PERFORM public.notify_org(seller_org, 'seller_first_bid', 'First bid received',
      format('Your auction "%s" received its first bid of $%s.', COALESCE(lot_title, 'your listing'), NEW.amount::text),
      '/app/seller/lots', NULL, NEW.lot_id, NULL, 'normal');
  END IF;
  SELECT user_id, amount INTO prev FROM public.bids
    WHERE lot_id=NEW.lot_id AND id <> NEW.id AND user_id <> NEW.user_id
    ORDER BY amount DESC LIMIT 1;
  IF prev.user_id IS NOT NULL AND prev.amount < NEW.amount THEN
    PERFORM public.notify_user(prev.user_id, 'outbid', 'You were outbid',
      format('Someone outbid you on "%s". Current bid $%s.', lot_title, NEW.amount::text),
      '/lot/'||NEW.lot_id, NULL, NEW.lot_id, NULL, NULL, true, 'high');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bids_notify ON public.bids;
CREATE TRIGGER trg_bids_notify AFTER INSERT ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_bid();

CREATE OR REPLACE FUNCTION public.notify_on_lot_published() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE seller_org uuid;
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'active')) THEN
    SELECT ce.org_id INTO seller_org FROM public.clearance_events ce WHERE ce.id = NEW.event_id;
    PERFORM public.notify_org(seller_org, 'listing_published', 'Listing published',
      format('"%s" is now live on Offcutt.', NEW.title),
      '/lot/' || NEW.id, NULL, NEW.id, NULL, 'normal');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_lots_notify_published ON public.lots;
CREATE TRIGGER trg_lots_notify_published
AFTER INSERT OR UPDATE OF status ON public.lots
FOR EACH ROW EXECUTE FUNCTION public.notify_on_lot_published();

CREATE OR REPLACE FUNCTION public.create_scheduled_email_notifications()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE auction_count integer := 0; pickup_count integer := 0;
BEGIN
  WITH watched_users AS (
    SELECT DISTINCT w.user_id, l.id AS lot_id, l.title, l.auction_end
    FROM public.lots l JOIN public.watchlist w ON w.lot_id = l.id
    WHERE l.pricing_type = 'auction' AND l.status = 'active'
      AND l.auction_end > now() AND l.auction_end <= now() + interval '24 hours'
  ),
  bidder_users AS (
    SELECT DISTINCT b.user_id, l.id AS lot_id, l.title, l.auction_end
    FROM public.lots l JOIN public.bids b ON b.lot_id = l.id
    WHERE l.pricing_type = 'auction' AND l.status = 'active'
      AND l.auction_end > now() AND l.auction_end <= now() + interval '24 hours'
  ),
  targets AS (SELECT * FROM watched_users UNION SELECT * FROM bidder_users),
  inserted AS (
    INSERT INTO public.notifications (user_id, type, title, message, related_lot_id, link_url, email_should_send, priority, data)
    SELECT t.user_id, 'auction_ending_soon', 'Auction ending soon',
      format('"%s" ends soon. Place your final bid before the auction closes.', t.title),
      t.lot_id, '/lot/' || t.lot_id, true, 'normal',
      jsonb_build_object('lot_id', t.lot_id, 'auction_end', t.auction_end)
    FROM targets t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = t.user_id AND n.type = 'auction_ending_soon' AND n.related_lot_id = t.lot_id
    ) RETURNING 1
  )
  SELECT count(*) INTO auction_count FROM inserted;

  WITH target_orders AS (
    SELECT o.id, o.buyer_id, o.lot_id, o.agreed_pickup_at, l.title, ce.org_id AS seller_org_id
    FROM public.orders o JOIN public.lots l ON l.id = o.lot_id
    JOIN public.clearance_events ce ON ce.id = l.event_id
    WHERE o.agreed_pickup_at > now() AND o.agreed_pickup_at <= now() + interval '24 hours'
      AND o.status IN ('paid', 'ready_for_pickup')
  ),
  buyer_inserted AS (
    INSERT INTO public.notifications (user_id, type, title, message, related_order_id, related_lot_id, link_url, email_should_send, priority, data)
    SELECT o.buyer_id, 'pickup_reminder', 'Pickup reminder',
      format('Reminder: pickup for "%s" is scheduled within the next 24 hours.', o.title),
      o.id, o.lot_id, '/app/orders/' || o.id, true, 'normal',
      jsonb_build_object('order_id', o.id, 'agreed_pickup_at', o.agreed_pickup_at)
    FROM target_orders o
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = o.buyer_id AND n.type = 'pickup_reminder' AND n.related_order_id = o.id
    ) RETURNING 1
  ),
  seller_targets AS (
    SELECT DISTINCT om.user_id, o.id, o.lot_id, o.title, o.agreed_pickup_at
    FROM target_orders o JOIN public.org_members om ON om.org_id = o.seller_org_id
  ),
  seller_inserted AS (
    INSERT INTO public.notifications (user_id, type, title, message, related_order_id, related_lot_id, link_url, email_should_send, priority, data)
    SELECT s.user_id, 'pickup_reminder', 'Pickup reminder',
      format('Reminder: pickup for "%s" is scheduled within the next 24 hours.', s.title),
      s.id, s.lot_id, '/app/orders/' || s.id, true, 'normal',
      jsonb_build_object('order_id', s.id, 'agreed_pickup_at', s.agreed_pickup_at)
    FROM seller_targets s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = s.user_id AND n.type = 'pickup_reminder' AND n.related_order_id = s.id
    ) RETURNING 1
  )
  SELECT (SELECT count(*) FROM buyer_inserted) + (SELECT count(*) FROM seller_inserted) INTO pickup_count;

  RETURN jsonb_build_object('auction_ending_soon_notifications', auction_count, 'pickup_reminder_notifications', pickup_count);
END; $$;

REVOKE EXECUTE ON FUNCTION public.notification_type_should_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_type_should_email(text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_scheduled_email_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_scheduled_email_notifications() TO service_role;

CREATE OR REPLACE FUNCTION public.notify_on_payout_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE seller_org uuid; lot_title text; o record;
BEGIN
  SELECT lot_id INTO o FROM public.orders WHERE id = NEW.order_id;
  SELECT ce.org_id, l.title INTO seller_org, lot_title FROM public.lots l
    JOIN public.clearance_events ce ON ce.id=l.event_id WHERE l.id = o.lot_id;
  IF TG_OP='UPDATE' AND NEW.manual_payout_status IS DISTINCT FROM OLD.manual_payout_status THEN
    IF NEW.manual_payout_status='manual_payout_paid' THEN
      PERFORM public.notify_org(seller_org, 'payout_paid', 'Payout paid',
        format('Your payout for "%s" has been marked paid.%s', COALESCE(lot_title,'(lot)'),
          CASE WHEN NEW.manual_payout_reference IS NOT NULL THEN ' Reference: ' || NEW.manual_payout_reference || '.' ELSE '' END),
        '/app/seller/payouts', NEW.order_id, NULL, NULL, 'normal');
    ELSIF NEW.manual_payout_status='manual_payout_on_hold' THEN
      PERFORM public.notify_org(seller_org, 'payout_on_hold', 'Payout on hold',
        format('Your payout for "%s" is on hold. Offcutt will contact you.', COALESCE(lot_title,'(lot)')),
        '/app/seller/payouts', NEW.order_id, NULL, NULL, 'high');
      PERFORM public.notify_admins('admin_payout_on_hold', 'Payout placed on hold',
        format('Payout for "%s" placed on hold.', COALESCE(lot_title,'(lot)')),
        '/app/admin/payouts', NEW.order_id, NULL, NULL, 'high');
    ELSIF NEW.manual_payout_status='manual_payout_failed' THEN
      PERFORM public.notify_org(seller_org, 'payout_failed', 'Payout failed',
        format('Your payout for "%s" failed. Offcutt will contact you.', COALESCE(lot_title,'(lot)')),
        '/app/seller/payouts', NEW.order_id, NULL, NULL, 'high');
    ELSIF NEW.manual_payout_status='manual_payout_pending' THEN
      PERFORM public.notify_org(seller_org, 'payout_scheduled', 'Payout being prepared',
        format('Your payout for "%s" is being prepared and will be released once collection and payout checks pass.', COALESCE(lot_title,'(lot)')),
        '/app/seller/payouts', NEW.order_id, NULL, NULL, 'normal');
    END IF;
  END IF;
  IF TG_OP='INSERT' AND NEW.status='succeeded' AND NEW.manual_payout_status='manual_payout_pending' THEN
    PERFORM public.notify_org(seller_org, 'payout_scheduled', 'Payout being prepared',
      format('Your payout for "%s" is being prepared and will be released once collection and payout checks pass.', COALESCE(lot_title,'(lot)')),
      '/app/seller/payouts', NEW.order_id, NULL, NULL, 'normal');
    PERFORM public.notify_admins('admin_payout_pending', 'Manual payout pending',
      'A new paid order needs payout review.', '/app/admin/payouts', NEW.order_id, NULL, NULL, 'normal');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payments_notify ON public.payments;
CREATE TRIGGER trg_payments_notify AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_payout_change();