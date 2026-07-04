
-- Kill switch for automated Stripe seller transfers.
ALTER TABLE public.auction_deposit_settings
  ADD COLUMN IF NOT EXISTS auto_payouts_enabled boolean NOT NULL DEFAULT true;

-- pg_net for HTTP calls from triggers/cron.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: fire auto-payout when an order becomes 'collected'.
-- Reads project URL + anon key from GUCs (`app.settings.*`) that are set via
-- ALTER DATABASE ... SET (populated by a separate insert-tool step so remixes
-- don't inherit the deployer's project ref).
CREATE OR REPLACE FUNCTION public.trigger_auto_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  base_url text;
  anon_key text;
BEGIN
  IF NEW.status = 'collected' AND OLD.status IS DISTINCT FROM 'collected' THEN
    BEGIN
      base_url := current_setting('app.settings.supabase_url', true);
      anon_key := current_setting('app.settings.supabase_anon_key', true);
    EXCEPTION WHEN OTHERS THEN
      base_url := NULL; anon_key := NULL;
    END;

    IF base_url IS NULL OR anon_key IS NULL THEN
      RAISE WARNING 'trigger_auto_payout: app.settings.supabase_url/anon_key not set; skipping';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := base_url || '/functions/v1/auto-payout-on-collected',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', anon_key,
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object('order_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_auto_payout_on_collected ON public.orders;
CREATE TRIGGER orders_auto_payout_on_collected
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_auto_payout();
