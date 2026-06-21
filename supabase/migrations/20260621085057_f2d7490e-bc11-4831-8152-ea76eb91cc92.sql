
-- 1. Helper: release a reserved lot back to active if no payment captured.
CREATE OR REPLACE FUNCTION public.release_lot_reservation(_lot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lots
  SET status = 'active',
      reserved_order_id = NULL,
      reserved_until = NULL,
      updated_at = now()
  WHERE id = _lot_id
    AND status = 'reserved';
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_lot_reservation(uuid) TO authenticated, service_role;

-- 2. Sweep all reservations that have expired (called best-effort from clients).
CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  freed integer;
BEGIN
  WITH updated AS (
    UPDATE public.lots
    SET status = 'active',
        reserved_order_id = NULL,
        reserved_until = NULL,
        updated_at = now()
    WHERE status = 'reserved'
      AND reserved_until IS NOT NULL
      AND reserved_until < now()
      AND (
        reserved_order_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = lots.reserved_order_id
            AND o.status IN ('pending_payment', 'cancelled')
        )
      )
    RETURNING 1
  )
  SELECT count(*) INTO freed FROM updated;
  RETURN COALESCE(freed, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_expired_reservations() TO anon, authenticated, service_role;

-- 3. When an order gets cancelled, release its lot reservation.
CREATE OR REPLACE FUNCTION public.release_lot_on_order_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND NEW.lot_id IS NOT NULL THEN
    PERFORM public.release_lot_reservation(NEW.lot_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_release_lot_on_cancel ON public.orders;
CREATE TRIGGER trg_orders_release_lot_on_cancel
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.release_lot_on_order_cancel();
