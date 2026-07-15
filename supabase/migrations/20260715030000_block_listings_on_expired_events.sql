-- Event dates control whether sellers may add new inventory to an event.
-- Existing lots keep their own lifecycle and are not cancelled or hidden when
-- the parent event pickup window ends.
CREATE OR REPLACE FUNCTION public.guard_lot_event_is_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_record record;
BEGIN
  -- Existing lots must still be able to progress through reservation, sale,
  -- payment and pickup states after their event ends. Re-check only when a lot
  -- is created, moved to another event, or a draft is published.
  IF TG_OP = 'UPDATE'
     AND NEW.event_id IS NOT DISTINCT FROM OLD.event_id
     AND NOT (OLD.status = 'draft' AND NEW.status = 'active') THEN
    RETURN NEW;
  END IF;

  SELECT ce.status, ce.pickup_end
  INTO event_record
  FROM public.clearance_events ce
  WHERE ce.id = NEW.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'event_not_found: select a valid clearance event';
  END IF;

  IF event_record.pickup_end <= now() THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'event_expired: this clearance event has ended and cannot accept new listings';
  END IF;

  IF event_record.status::text NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'event_closed: only draft or active events can accept new listings';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lots_guard_event_is_open ON public.lots;
CREATE TRIGGER trg_lots_guard_event_is_open
BEFORE INSERT OR UPDATE OF event_id, status ON public.lots
FOR EACH ROW
EXECUTE FUNCTION public.guard_lot_event_is_open();

REVOKE ALL ON FUNCTION public.guard_lot_event_is_open() FROM PUBLIC;
