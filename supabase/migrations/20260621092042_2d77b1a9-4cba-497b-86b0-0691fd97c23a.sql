
-- 1. Extend notifications table
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_lot_id uuid REFERENCES public.lots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_report_id uuid REFERENCES public.lot_reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_should_send boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- Keep read_at in sync with legacy `read` boolean
CREATE OR REPLACE FUNCTION public.notifications_sync_read() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.read = true AND OLD.read = false AND NEW.read_at IS NULL THEN
    NEW.read_at := now();
  END IF;
  IF NEW.read = false THEN NEW.read_at := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notifications_sync_read ON public.notifications;
CREATE TRIGGER trg_notifications_sync_read BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_sync_read();

-- 2. Helper: create notification (SECURITY DEFINER so triggers can insert for other users)
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
    _email, _priority, '{}'::jsonb)
  RETURNING id INTO nid;
  RETURN nid;
END $$;

-- Notify all admins
CREATE OR REPLACE FUNCTION public.notify_admins(
  _type text, _title text, _message text, _link_url text DEFAULT NULL,
  _order_id uuid DEFAULT NULL, _lot_id uuid DEFAULT NULL,
  _report_id uuid DEFAULT NULL, _priority text DEFAULT 'normal'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role='admin' LOOP
    PERFORM public.notify_user(r.user_id, _type, _title, _message, _link_url,
      _order_id, _lot_id, NULL, _report_id, false, _priority);
  END LOOP;
END $$;

-- Notify all members of an org
CREATE OR REPLACE FUNCTION public.notify_org(
  _org_id uuid, _type text, _title text, _message text, _link_url text DEFAULT NULL,
  _order_id uuid DEFAULT NULL, _lot_id uuid DEFAULT NULL,
  _conversation_id uuid DEFAULT NULL, _priority text DEFAULT 'normal'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
  IF _org_id IS NULL THEN RETURN; END IF;
  FOR r IN SELECT user_id FROM public.org_members WHERE org_id=_org_id LOOP
    PERFORM public.notify_user(r.user_id, _type, _title, _message, _link_url,
      _order_id, _lot_id, _conversation_id, NULL, false, _priority);
  END LOOP;
END $$;

-- 3. Order lifecycle notifications
CREATE OR REPLACE FUNCTION public.notify_on_order_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  seller_org uuid; lot_title text;
BEGIN
  SELECT ce.org_id, l.title INTO seller_org, lot_title
    FROM public.lots l JOIN public.clearance_events ce ON ce.id=l.event_id
    WHERE l.id = NEW.lot_id;

  IF TG_OP='INSERT' THEN
    -- New paid order? (rare on insert) handled by status transitions below
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'paid' THEN
      PERFORM public.notify_user(NEW.buyer_id, 'order_paid', 'Payment successful',
        format('Your payment for "%s" was successful. The seller has been notified.', lot_title),
        '/app/orders/'||NEW.id, NEW.id, NEW.lot_id, NULL, NULL, false, 'normal');
      PERFORM public.notify_org(seller_org, 'new_sale', 'New item sold',
        format('"%s" was purchased. Arrange pickup with the buyer.', lot_title),
        '/app/orders/'||NEW.id, NEW.id, NEW.lot_id, NULL, 'high');
      PERFORM public.notify_admins('admin_new_paid_order', 'New paid order',
        format('Paid order for "%s" ($%s)', lot_title, NEW.amount::text),
        '/app/admin/orders', NEW.id, NEW.lot_id, NULL, 'normal');
    ELSIF NEW.status = 'cancelled' THEN
      PERFORM public.notify_user(NEW.buyer_id, 'order_cancelled', 'Order cancelled',
        format('Your order for "%s" was cancelled.', lot_title),
        '/app/orders/'||NEW.id, NEW.id, NEW.lot_id, NULL, NULL, false, 'high');
      PERFORM public.notify_org(seller_org, 'order_cancelled', 'Order cancelled',
        format('The order for "%s" was cancelled.', lot_title),
        '/app/orders/'||NEW.id, NEW.id, NEW.lot_id, NULL, 'normal');
    ELSIF NEW.status = 'ready_for_pickup' THEN
      PERFORM public.notify_user(NEW.buyer_id, 'ready_for_pickup', 'Item ready for pickup',
        format('"%s" is ready. Show your pickup code to the seller.', lot_title),
        '/app/orders/'||NEW.id, NEW.id, NEW.lot_id, NULL, NULL, false, 'high');
    ELSIF NEW.status = 'collected' THEN
      PERFORM public.notify_user(NEW.buyer_id, 'order_collected', 'Pickup completed',
        format('Pickup of "%s" is confirmed. Please leave a review.', lot_title),
        '/app/orders/'||NEW.id, NEW.id, NEW.lot_id, NULL, NULL, false, 'normal');
      PERFORM public.notify_org(seller_org, 'order_collected', 'Pickup completed',
        format('"%s" has been collected. Payout will be processed.', lot_title),
        '/app/orders/'||NEW.id, NEW.id, NEW.lot_id, NULL, 'normal');
    END IF;
  END IF;

  IF NEW.proposed_pickup_at IS DISTINCT FROM OLD.proposed_pickup_at AND NEW.proposed_pickup_at IS NOT NULL THEN
    -- Notify the other party
    IF NEW.proposed_pickup_by = NEW.buyer_id THEN
      PERFORM public.notify_org(seller_org, 'pickup_proposed', 'Buyer proposed a pickup time',
        format('Pickup time proposed for "%s".', lot_title),
        '/app/orders/'||NEW.id, NEW.id, NEW.lot_id, NULL, 'normal');
    ELSE
      PERFORM public.notify_user(NEW.buyer_id, 'pickup_proposed', 'Seller proposed a pickup time',
        format('Pickup time proposed for "%s".', lot_title),
        '/app/orders/'||NEW.id, NEW.id, NEW.lot_id, NULL, NULL, false, 'normal');
    END IF;
  END IF;

  IF NEW.agreed_pickup_at IS DISTINCT FROM OLD.agreed_pickup_at AND NEW.agreed_pickup_at IS NOT NULL THEN
    PERFORM public.notify_user(NEW.buyer_id, 'pickup_agreed', 'Pickup time confirmed',
      format('Pickup confirmed for "%s".', lot_title),
      '/app/orders/'||NEW.id, NEW.id, NEW.lot_id, NULL, NULL, false, 'normal');
    PERFORM public.notify_org(seller_org, 'pickup_agreed', 'Pickup time confirmed',
      format('Pickup confirmed for "%s".', lot_title),
      '/app/orders/'||NEW.id, NEW.id, NEW.lot_id, NULL, 'normal');
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_notify ON public.orders;
CREATE TRIGGER trg_orders_notify AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_order_change();

-- 4. Message notifications
CREATE OR REPLACE FUNCTION public.notify_on_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; lot_title text;
BEGIN
  IF NEW.is_system THEN RETURN NEW; END IF;
  SELECT buyer_id, seller_org_id, lot_id, order_id INTO c
    FROM public.conversations WHERE id=NEW.conversation_id;
  SELECT title INTO lot_title FROM public.lots WHERE id=c.lot_id;
  IF NEW.sender_id = c.buyer_id THEN
    PERFORM public.notify_org(c.seller_org_id, 'new_message', 'New message from buyer',
      COALESCE('Re: '||lot_title, 'You have a new message'),
      '/app/messages/'||NEW.conversation_id, c.order_id, c.lot_id, NEW.conversation_id, 'normal');
  ELSE
    PERFORM public.notify_user(c.buyer_id, 'new_message', 'New message from seller',
      COALESCE('Re: '||lot_title, 'You have a new message'),
      '/app/messages/'||NEW.conversation_id, c.order_id, c.lot_id, NEW.conversation_id, NULL, false, 'normal');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_messages_notify ON public.messages;
CREATE TRIGGER trg_messages_notify AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- 5. Report notifications -> admins + reporter on resolve
CREATE OR REPLACE FUNCTION public.notify_on_report() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lot_title text;
BEGIN
  SELECT title INTO lot_title FROM public.lots WHERE id=NEW.lot_id;
  IF TG_OP='INSERT' THEN
    PERFORM public.notify_admins('admin_report', 'New listing report',
      format('"%s" was reported (%s)', COALESCE(lot_title,'(deleted)'), NEW.reason),
      '/app/admin/reports', NULL, NEW.lot_id, NEW.id, 'high');
    PERFORM public.notify_user(NEW.reporter_id, 'report_received', 'Report received',
      'Thanks for the report. We will review it shortly.',
      '/app/admin/reports', NULL, NEW.lot_id, NULL, NEW.id, false, 'normal');
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('resolved','dismissed') THEN
    PERFORM public.notify_user(NEW.reporter_id, 'report_resolved', 'Report '||NEW.status,
      format('Your report on "%s" is %s.', COALESCE(lot_title,'(removed)'), NEW.status),
      '/app/buyer/overview', NULL, NEW.lot_id, NULL, NEW.id, false, 'normal');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_reports_notify ON public.lot_reports;
CREATE TRIGGER trg_reports_notify AFTER INSERT OR UPDATE ON public.lot_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_report();

-- 6. Outbid notifications
CREATE OR REPLACE FUNCTION public.notify_on_bid() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prev record; lot_title text;
BEGIN
  SELECT title INTO lot_title FROM public.lots WHERE id=NEW.lot_id;
  -- find previously winning user different from NEW.user_id
  SELECT user_id, amount INTO prev FROM public.bids
    WHERE lot_id=NEW.lot_id AND id <> NEW.id AND user_id <> NEW.user_id
    ORDER BY amount DESC LIMIT 1;
  IF prev.user_id IS NOT NULL AND prev.amount < NEW.amount THEN
    PERFORM public.notify_user(prev.user_id, 'outbid', 'You were outbid',
      format('Someone outbid you on "%s". Current bid $%s.', lot_title, NEW.amount::text),
      '/lot/'||NEW.lot_id, NULL, NEW.lot_id, NULL, NULL, false, 'high');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bids_notify ON public.bids;
CREATE TRIGGER trg_bids_notify AFTER INSERT ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_bid();

-- 7. Payout-state-change notifications
CREATE OR REPLACE FUNCTION public.notify_on_payout_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE seller_org uuid; lot_title text; o record;
BEGIN
  IF TG_OP='UPDATE' AND NEW.manual_payout_status IS DISTINCT FROM OLD.manual_payout_status THEN
    SELECT lot_id INTO o FROM public.orders WHERE id = NEW.order_id;
    SELECT ce.org_id, l.title INTO seller_org, lot_title FROM public.lots l
      JOIN public.clearance_events ce ON ce.id=l.event_id WHERE l.id = o.lot_id;
    IF NEW.manual_payout_status='manual_payout_paid' THEN
      PERFORM public.notify_org(seller_org, 'payout_paid', 'Payout paid',
        format('Your payout for "%s" has been marked paid.', COALESCE(lot_title,'(lot)')),
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
    END IF;
  END IF;

  IF TG_OP='INSERT' AND NEW.status='succeeded' AND NEW.manual_payout_status='manual_payout_pending' THEN
    PERFORM public.notify_admins('admin_payout_pending', 'Manual payout pending',
      'A new paid order needs manual payout.', '/app/admin/payouts',
      NEW.order_id, NULL, NULL, 'normal');
  END IF;

  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_payments_notify ON public.payments;
CREATE TRIGGER trg_payments_notify AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_payout_change();

-- 8. Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_cancel_order(_order_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
  ALTER TABLE public.orders DISABLE TRIGGER USER;
  UPDATE public.orders SET status='cancelled',
    admin_notes = COALESCE(admin_notes||E'\n','') || COALESCE(_note,'Cancelled by admin'),
    updated_at=now() WHERE id=_order_id;
  ALTER TABLE public.orders ENABLE TRIGGER USER;
  -- manually free lot since user-triggers disabled above
  PERFORM public.release_lot_reservation((SELECT lot_id FROM public.orders WHERE id=_order_id));
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_payout_status(
  _payment_id uuid, _status text, _reference text DEFAULT NULL, _note text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p record; ord record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
  IF _status NOT IN ('manual_payout_pending','manual_payout_paid','manual_payout_on_hold','manual_payout_failed') THEN
    RAISE EXCEPTION 'Invalid payout status';
  END IF;

  SELECT * INTO p FROM public.payments WHERE id=_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  IF _status='manual_payout_paid' THEN
    IF p.status <> 'succeeded' THEN RAISE EXCEPTION 'Cannot mark payout paid: payment is %', p.status; END IF;
    SELECT * INTO ord FROM public.orders WHERE id=p.order_id;
    IF ord.status IN ('cancelled','refunded') THEN
      RAISE EXCEPTION 'Cannot mark payout paid: order is %', ord.status;
    END IF;
  END IF;

  UPDATE public.payments SET
    manual_payout_status=_status,
    manual_payout_reference = COALESCE(_reference, manual_payout_reference),
    admin_notes = CASE WHEN _note IS NULL THEN admin_notes
                       ELSE COALESCE(admin_notes||E'\n','') || _note END,
    manual_payout_paid_at = CASE WHEN _status='manual_payout_paid' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id=_payment_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(
  _report_id uuid, _status text, _note text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
  IF _status NOT IN ('open','investigating','resolved','dismissed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.lot_reports SET
    status = _status,
    resolved_by = CASE WHEN _status IN ('resolved','dismissed') THEN auth.uid() ELSE resolved_by END,
    resolved_at = CASE WHEN _status IN ('resolved','dismissed') THEN now() ELSE NULL END,
    details = CASE WHEN _note IS NULL THEN details
                   ELSE COALESCE(details||E'\n---\nAdmin: ','Admin: ')||_note END
  WHERE id = _report_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_org_verified(_org_id uuid, _verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
  UPDATE public.organizations SET is_verified=_verified, updated_at=now() WHERE id=_org_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_org_founding(_org_id uuid, _founding boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
  UPDATE public.organizations SET is_founding=_founding, updated_at=now() WHERE id=_org_id;
  IF _founding THEN
    INSERT INTO public.seller_badges(org_id, badge, granted_by)
    VALUES(_org_id, 'founding_seller', auth.uid())
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.seller_badges WHERE org_id=_org_id AND badge='founding_seller';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_org_disabled(_org_id uuid, _disabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
  UPDATE public.organizations SET is_disabled=_disabled, updated_at=now() WHERE id=_org_id;
END $$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  WITH u AS (UPDATE public.notifications SET read=true, read_at=now()
             WHERE user_id=auth.uid() AND read=false RETURNING 1)
  SELECT count(*) INTO n FROM u;
  RETURN COALESCE(n,0);
END $$;

-- 9. Stuck orders view (admin diagnostic)
CREATE OR REPLACE VIEW public.admin_stuck_orders AS
SELECT
  o.id AS order_id, o.status, o.pickup_status, o.amount, o.created_at, o.updated_at,
  l.title AS lot_title, l.id AS lot_id, l.status AS lot_status,
  o.pickup_code, o.proposed_pickup_at, o.agreed_pickup_at,
  p.status AS payment_status, p.manual_payout_status,
  EXISTS(SELECT 1 FROM public.conversations c WHERE c.order_id=o.id) AS has_conversation,
  EXISTS(SELECT 1 FROM public.lot_reports r WHERE r.order_id=o.id AND r.status IN ('open','investigating')) AS has_open_issue,
  CASE
    WHEN o.status='pending_payment' AND o.created_at < now() - interval '30 minutes' THEN 'pending_payment_too_long'
    WHEN o.status IN ('paid','ready_for_pickup') AND o.pickup_code IS NULL THEN 'paid_no_pickup_code'
    WHEN o.status IN ('paid','ready_for_pickup') AND NOT EXISTS(SELECT 1 FROM public.conversations c WHERE c.order_id=o.id) THEN 'paid_no_conversation'
    WHEN o.proposed_pickup_at IS NOT NULL AND o.proposed_pickup_at < now() AND o.status NOT IN ('collected','cancelled') THEN 'pickup_in_past'
    WHEN p.manual_payout_status='manual_payout_pending' AND o.status='collected' AND o.updated_at < now() - interval '7 days' THEN 'payout_overdue'
    WHEN EXISTS(SELECT 1 FROM public.lot_reports r WHERE r.order_id=o.id AND r.status IN ('open','investigating')) THEN 'issue_open'
    ELSE NULL
  END AS stuck_reason
FROM public.orders o
LEFT JOIN public.lots l ON l.id=o.lot_id
LEFT JOIN public.payments p ON p.order_id=o.id;

GRANT SELECT ON public.admin_stuck_orders TO authenticated;
