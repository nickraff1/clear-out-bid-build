
-- Disable order protect trigger during backfill (migration context only).
ALTER TABLE public.orders DISABLE TRIGGER USER;

UPDATE public.orders
SET pickup_code = public.generate_pickup_code(),
    pickup_status = COALESCE(pickup_status, 'awaiting_arrangement'),
    updated_at = now()
WHERE status IN ('paid','ready_for_pickup')
  AND pickup_code IS NULL;

ALTER TABLE public.orders ENABLE TRIGGER USER;

-- Close expired auction backlog (no reserve met -> unsold).
UPDATE public.lots l
SET status = 'unsold', updated_at = now()
WHERE l.status = 'active'
  AND l.pricing_type = 'auction'
  AND l.auction_end < now()
  AND NOT EXISTS (
    SELECT 1 FROM public.bids b
    WHERE b.lot_id = l.id
      AND b.is_winning = true
      AND (l.reserve_price IS NULL OR b.amount >= l.reserve_price)
  );

-- Seller cannot bid on their own lot.
CREATE OR REPLACE FUNCTION public.prevent_seller_self_bid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE seller_org uuid;
BEGIN
  SELECT ce.org_id INTO seller_org
  FROM public.lots l JOIN public.clearance_events ce ON ce.id=l.event_id
  WHERE l.id = NEW.lot_id;
  IF seller_org IS NOT NULL AND public.is_org_member(NEW.user_id, seller_org) THEN
    RAISE EXCEPTION 'Sellers cannot bid on their own listings' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bids_prevent_self_bid ON public.bids;
CREATE TRIGGER trg_bids_prevent_self_bid
BEFORE INSERT ON public.bids
FOR EACH ROW EXECUTE FUNCTION public.prevent_seller_self_bid();

-- Pickup proposal validation.
CREATE OR REPLACE FUNCTION public.validate_pickup_proposal()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.proposed_pickup_at IS NOT NULL
     AND NEW.proposed_pickup_at IS DISTINCT FROM OLD.proposed_pickup_at
     AND NEW.proposed_pickup_at < now() THEN
    RAISE EXCEPTION 'Proposed pickup time must be in the future';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_orders_validate_pickup ON public.orders;
CREATE TRIGGER trg_orders_validate_pickup
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_pickup_proposal();

-- Auction closer helper (single lot).
CREATE OR REPLACE FUNCTION public.close_expired_auction(_lot_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  lot_rec record; winning record;
  base_amount numeric; buyer_fee numeric; total_amount numeric;
  new_order_id uuid;
BEGIN
  SELECT * INTO lot_rec FROM public.lots WHERE id=_lot_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF lot_rec.pricing_type <> 'auction' THEN RETURN 'not_auction'; END IF;
  IF lot_rec.status <> 'active' THEN RETURN 'not_active'; END IF;
  IF lot_rec.auction_end IS NULL OR lot_rec.auction_end > now() THEN RETURN 'not_ended'; END IF;

  SELECT * INTO winning FROM public.bids
    WHERE lot_id=_lot_id AND is_winning=true
    ORDER BY amount DESC LIMIT 1;

  IF NOT FOUND OR (lot_rec.reserve_price IS NOT NULL AND winning.amount < lot_rec.reserve_price) THEN
    UPDATE public.lots SET status='unsold', updated_at=now() WHERE id=_lot_id;
    RETURN 'unsold';
  END IF;

  base_amount := winning.amount;
  buyer_fee := round(base_amount * 0.10, 2);
  total_amount := base_amount + buyer_fee;

  INSERT INTO public.orders (
    lot_id, event_id, buyer_id, buyer_org_id, amount, status, notes, pickup_status
  ) VALUES (
    _lot_id, lot_rec.event_id, winning.user_id, winning.org_id, total_amount,
    'pending_payment',
    format('Winning bid: $%s, Buyer fee (10%%): $%s', base_amount::text, buyer_fee::text),
    'awaiting_payment'
  ) RETURNING id INTO new_order_id;

  UPDATE public.lots
    SET status='reserved',
        reserved_order_id=new_order_id,
        reserved_until = now() + interval '24 hours',
        updated_at=now()
    WHERE id=_lot_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (winning.user_id, 'auction_won', 'You won an auction!',
    format('You won "%s". Complete payment within 24 hours to secure it.', lot_rec.title),
    jsonb_build_object('lot_id', _lot_id, 'order_id', new_order_id, 'amount', total_amount));

  RETURN 'sold';
END; $$;

GRANT EXECUTE ON FUNCTION public.close_expired_auction(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.close_all_expired_auctions()
RETURNS TABLE(lot_id uuid, result text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE rec record;
BEGIN
  FOR rec IN
    SELECT id FROM public.lots
    WHERE status='active' AND pricing_type='auction' AND auction_end < now()
  LOOP
    lot_id := rec.id;
    result := public.close_expired_auction(rec.id);
    RETURN NEXT;
  END LOOP;
END; $$;

GRANT EXECUTE ON FUNCTION public.close_all_expired_auctions() TO authenticated, service_role;

-- Admin override helpers: regenerate pickup code, force complete an order.
CREATE OR REPLACE FUNCTION public.admin_regenerate_pickup_code(_order_id uuid, _note text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_code text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE='42501';
  END IF;
  new_code := public.generate_pickup_code();
  ALTER TABLE public.orders DISABLE TRIGGER USER;
  UPDATE public.orders
    SET pickup_code = new_code,
        admin_notes = COALESCE(admin_notes || E'\n', '') || COALESCE(_note, 'Pickup code regenerated by admin'),
        updated_at = now()
    WHERE id = _order_id;
  ALTER TABLE public.orders ENABLE TRIGGER USER;
  RETURN new_code;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_regenerate_pickup_code(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_force_complete_order(_order_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE='42501';
  END IF;
  ALTER TABLE public.orders DISABLE TRIGGER USER;
  UPDATE public.orders
    SET status='collected',
        pickup_status='collected',
        buyer_collected_at = COALESCE(buyer_collected_at, now()),
        seller_confirmed_at = COALESCE(seller_confirmed_at, now()),
        admin_notes = COALESCE(admin_notes || E'\n','') || COALESCE(_note, 'Order force-completed by admin'),
        updated_at = now()
    WHERE id = _order_id;
  ALTER TABLE public.orders ENABLE TRIGGER USER;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_force_complete_order(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_add_order_note(_order_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE='42501';
  END IF;
  ALTER TABLE public.orders DISABLE TRIGGER USER;
  UPDATE public.orders
    SET admin_notes = COALESCE(admin_notes || E'\n','') || _note,
        updated_at = now()
    WHERE id = _order_id;
  ALTER TABLE public.orders ENABLE TRIGGER USER;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_add_order_note(uuid, text) TO authenticated;
