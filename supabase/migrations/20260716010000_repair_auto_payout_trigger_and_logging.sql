-- Repair the collected-order payout trigger after older migrations redefined it
-- with a hard-coded project URL. The trigger must use the current deployment
-- settings so Lovable/Supabase remixes and production environments call their
-- own auto-payout-on-collected Edge Function.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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
      base_url := nullif(current_setting('app.settings.supabase_url', true), '');
      anon_key := nullif(current_setting('app.settings.supabase_anon_key', true), '');
    EXCEPTION WHEN OTHERS THEN
      base_url := NULL;
      anon_key := NULL;
    END;

    IF base_url IS NULL OR anon_key IS NULL THEN
      INSERT INTO public.payment_transfer_reconciliation (
        payment_id,
        order_id,
        seller_org_id,
        event_type,
        outcome,
        environment,
        error_code,
        error_message,
        metadata
      )
      SELECT
        p.id,
        NEW.id,
        ce.org_id,
        'transfer_skipped',
        'skipped',
        COALESCE(p.environment, 'sandbox'),
        'auto_payout_trigger_not_configured',
        'app.settings.supabase_url or app.settings.supabase_anon_key is missing; collected-order auto payout was not invoked.',
        jsonb_build_object('trigger', 'orders_auto_payout_on_collected')
      FROM public.payments p
      LEFT JOIN public.clearance_events ce ON ce.id = NEW.event_id
      WHERE p.order_id = NEW.id
        AND p.status = 'succeeded'
        AND p.stripe_transfer_id IS NULL
      ORDER BY p.created_at DESC
      LIMIT 1;

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
