
-- Guard: reject bids if event pickup_end is in the past
CREATE OR REPLACE FUNCTION public.bids_check_pickup_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pickup_end timestamptz;
BEGIN
  SELECT e.pickup_end INTO v_pickup_end
  FROM public.lots l
  JOIN public.clearance_events e ON e.id = l.event_id
  WHERE l.id = NEW.lot_id;

  IF v_pickup_end IS NOT NULL AND v_pickup_end < now() THEN
    RAISE EXCEPTION 'pickup_window_expired: this listing is no longer available — pickup window has closed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bids_check_pickup_window ON public.bids;
CREATE TRIGGER trg_bids_check_pickup_window
BEFORE INSERT ON public.bids
FOR EACH ROW EXECUTE FUNCTION public.bids_check_pickup_window();

-- Guard: reject orders if event pickup_end is in the past
CREATE OR REPLACE FUNCTION public.orders_check_pickup_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pickup_end timestamptz;
BEGIN
  IF NEW.lot_id IS NULL THEN RETURN NEW; END IF;
  SELECT e.pickup_end INTO v_pickup_end
  FROM public.lots l
  JOIN public.clearance_events e ON e.id = l.event_id
  WHERE l.id = NEW.lot_id;

  IF v_pickup_end IS NOT NULL AND v_pickup_end < now() THEN
    RAISE EXCEPTION 'pickup_window_expired: this listing is no longer available — pickup window has closed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_check_pickup_window ON public.orders;
CREATE TRIGGER trg_orders_check_pickup_window
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_check_pickup_window();
