CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages app_settings" ON public.app_settings;
CREATE POLICY "service role manages app_settings"
  ON public.app_settings FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO public.app_settings(key, value) VALUES
  ('supabase_url', 'https://uiusztanyjwmccdabtvs.supabase.co'),
  ('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpdXN6dGFueWp3bWNjZGFidHZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTI4MzIsImV4cCI6MjA4NTYyODgzMn0.Yca7Ojjnl9r27r-5aMDAJ0NLN4kmL2Ev6ceIP7bWm-E')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

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

    IF base_url IS NULL THEN
      SELECT value INTO base_url FROM public.app_settings WHERE key = 'supabase_url';
    END IF;
    IF anon_key IS NULL THEN
      SELECT value INTO anon_key FROM public.app_settings WHERE key = 'supabase_anon_key';
    END IF;

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
        'app_settings.supabase_url or supabase_anon_key is missing; collected-order auto payout was not invoked.',
        jsonb_build_object('trigger', 'orders_auto_payout_on_collected')
      FROM public.payments p
      LEFT JOIN public.clearance_events ce ON ce.id = NEW.event_id
      WHERE p.order_id = NEW.id
        AND p.status = 'succeeded'
        AND p.stripe_transfer_id IS NULL
      ORDER BY p.created_at DESC
      LIMIT 1;

      RAISE WARNING 'trigger_auto_payout: supabase_url/anon_key not configured; skipping';
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