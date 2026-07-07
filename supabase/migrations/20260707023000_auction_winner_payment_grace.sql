-- Give winning bidders a grace period after a saved-card charge failure.
-- When the grace period expires, the scheduled sweep defaults the winner and
-- offers the lot to the next-highest bidder instead of reopening it publicly.

UPDATE public.auction_deposit_settings
SET winner_payment_deadline_hours = 2
WHERE singleton = true;

CREATE OR REPLACE FUNCTION public.offer_to_next_bidder(_lot_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lot record;
  runner record;
  base numeric;
  fee numeric;
  total numeric;
  new_order_id uuid;
  deadline int;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE='42501';
  END IF;

  SELECT * INTO lot FROM public.lots WHERE id = _lot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lot not found'; END IF;

  SELECT * INTO runner FROM public.bids
    WHERE lot_id = _lot_id
      AND user_id <> COALESCE(lot.winning_bidder_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ORDER BY amount DESC
    LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No runner-up bidder available'; END IF;

  SELECT winner_payment_deadline_hours INTO deadline
  FROM public.auction_deposit_settings
  WHERE singleton = true;
  deadline := COALESCE(deadline, 24);

  base := runner.amount;
  fee := round(base * 0.10, 2);
  total := base + fee;

  INSERT INTO public.orders (
    lot_id,
    event_id,
    buyer_id,
    buyer_org_id,
    amount,
    status,
    notes,
    pickup_status,
    auction_payment_environment
  )
  VALUES (
    _lot_id,
    lot.event_id,
    runner.user_id,
    runner.org_id,
    total,
    'pending_payment',
    format('Offered to runner-up: $%s + 10%% fee', base::text),
    'awaiting_payment',
    COALESCE(runner.payment_environment, 'sandbox')
  )
  RETURNING id INTO new_order_id;

  UPDATE public.lots
    SET status = 'reserved',
        reserved_order_id = new_order_id,
        reserved_until = now() + (deadline || ' hours')::interval,
        winning_bidder_id = runner.user_id,
        updated_at = now()
    WHERE id = _lot_id;

  PERFORM public.notify_user(
    runner.user_id,
    'auction_won',
    'You are now the winning bidder',
    format('The first winner did not complete payment. "%s" is now offered to you at $%s. Offcutt will attempt to charge your saved card automatically.', lot.title, total::text),
    '/app/orders/' || new_order_id,
    new_order_id,
    _lot_id,
    NULL,
    NULL,
    false,
    'high'
  );

  RETURN new_order_id;
END $$;

CREATE OR REPLACE FUNCTION public.sweep_defaulted_winners()
RETURNS TABLE(order_id uuid, result text, next_order_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  deadline int;
  default_result text;
BEGIN
  SELECT winner_payment_deadline_hours INTO deadline
  FROM public.auction_deposit_settings
  WHERE singleton = true;
  deadline := COALESCE(deadline, 24);

  FOR rec IN
    SELECT o.id, o.lot_id
    FROM public.orders o
    JOIN public.lots l ON l.id = o.lot_id
    WHERE o.status = 'pending_payment'
      AND l.pricing_type = 'auction'
      AND o.created_at < now() - (deadline || ' hours')::interval
  LOOP
    order_id := rec.id;
    next_order_id := NULL;
    default_result := public.handle_defaulted_winner(rec.id);
    result := default_result;

    IF default_result = 'defaulted' THEN
      BEGIN
        next_order_id := public.offer_to_next_bidder(rec.lot_id);
        result := 'defaulted_offered_next';
      EXCEPTION WHEN OTHERS THEN
        result := 'defaulted_no_runner_up';
      END;
    END IF;

    RETURN NEXT;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.offer_to_next_bidder(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sweep_defaulted_winners() TO authenticated, service_role;
