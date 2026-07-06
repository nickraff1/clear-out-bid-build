ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS payment_environment text NOT NULL DEFAULT 'sandbox';

ALTER TABLE public.bids
  DROP CONSTRAINT IF EXISTS bids_payment_environment_check;

ALTER TABLE public.bids
  ADD CONSTRAINT bids_payment_environment_check
  CHECK (payment_environment IN ('sandbox', 'live'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS auction_payment_environment text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_auction_payment_environment_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_auction_payment_environment_check
  CHECK (auction_payment_environment IS NULL OR auction_payment_environment IN ('sandbox', 'live'));

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
    lot_id, event_id, buyer_id, buyer_org_id, amount, status, notes, pickup_status, auction_payment_environment
  ) VALUES (
    _lot_id, lot_rec.event_id, winning.user_id, winning.org_id, total_amount,
    'pending_payment',
    format('Winning bid: $%s, Buyer fee (10%%): $%s', base_amount::text, buyer_fee::text),
    'awaiting_payment',
    COALESCE(winning.payment_environment, 'sandbox')
  ) RETURNING id INTO new_order_id;

  UPDATE public.lots
    SET status='reserved',
        reserved_order_id=new_order_id,
        reserved_until = now() + interval '24 hours',
        winning_bidder_id=winning.user_id,
        updated_at=now()
    WHERE id=_lot_id;

  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (winning.user_id, 'auction_won', 'You won an auction!',
    format('You won "%s". Your saved card will be charged automatically.', lot_rec.title),
    jsonb_build_object('lot_id', _lot_id, 'order_id', new_order_id, 'amount', total_amount));

  RETURN 'sold';
END; $$;

GRANT EXECUTE ON FUNCTION public.close_expired_auction(uuid) TO authenticated, service_role;