-- Events are organisational containers for seller listings. Marketplace
-- availability must be controlled by the listing/order/auction state, not by
-- the parent event pickup window. Older guards hid or blocked otherwise-live
-- lots when an event's pickup_end passed.

DROP TRIGGER IF EXISTS trg_bids_check_pickup_window ON public.bids;
DROP TRIGGER IF EXISTS trg_orders_check_pickup_window ON public.orders;

DROP FUNCTION IF EXISTS public.bids_check_pickup_window();
DROP FUNCTION IF EXISTS public.orders_check_pickup_window();
