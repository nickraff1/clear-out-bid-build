-- Compatibility hardening for environments where the old event pickup-window
-- triggers are still present in schema cache or were not dropped during sync.
-- Events are containers; listing/order availability is enforced by lot status,
-- auction timing, reservation state, and payment state.

CREATE OR REPLACE FUNCTION public.bids_check_pickup_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_check_pickup_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bids_check_pickup_window ON public.bids;
DROP TRIGGER IF EXISTS trg_orders_check_pickup_window ON public.orders;
