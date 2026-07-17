-- Route winner and winner-payment notifications into the status-aware order guide.
-- This also repairs historical notifications where the order ID only existed in data JSON.

CREATE OR REPLACE FUNCTION public.notifications_set_email_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  data_order_id text;
  data_lot_id text;
BEGIN
  IF public.notification_type_should_email(NEW.type) THEN
    NEW.email_should_send := true;
  END IF;

  IF NEW.type IN ('auction_won', 'auction_payment_action_required', 'auction_payment_deadline') THEN
    data_order_id := NEW.data ->> 'order_id';
    data_lot_id := NEW.data ->> 'lot_id';

    IF NEW.related_order_id IS NULL
       AND data_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      NEW.related_order_id := data_order_id::uuid;
    END IF;

    IF NEW.related_lot_id IS NULL
       AND data_lot_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      NEW.related_lot_id := data_lot_id::uuid;
    END IF;

    IF NEW.related_order_id IS NOT NULL THEN
      NEW.link_url := '/app/orders/' || NEW.related_order_id::text || '?guide=1';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.notifications
SET related_order_id = (data ->> 'order_id')::uuid
WHERE type IN ('auction_won', 'auction_payment_action_required', 'auction_payment_deadline')
  AND related_order_id IS NULL
  AND (data ->> 'order_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE public.notifications
SET related_lot_id = (data ->> 'lot_id')::uuid
WHERE type IN ('auction_won', 'auction_payment_action_required', 'auction_payment_deadline')
  AND related_lot_id IS NULL
  AND (data ->> 'lot_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE public.notifications
SET link_url = '/app/orders/' || related_order_id::text || '?guide=1'
WHERE type IN ('auction_won', 'auction_payment_action_required', 'auction_payment_deadline')
  AND related_order_id IS NOT NULL;
