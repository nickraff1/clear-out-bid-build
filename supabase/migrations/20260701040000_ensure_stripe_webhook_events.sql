-- Ensure webhook idempotency/observability table exists in deployed backends.
-- A fresh forward migration is intentional because earlier payment hardening
-- may not have been applied in Lovable Cloud even when checkout is working.

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  processing_status text NOT NULL DEFAULT 'processing'
    CHECK (processing_status IN ('processing', 'processed', 'failed')),
  payload jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view Stripe webhook events" ON public.stripe_webhook_events;
CREATE POLICY "Admins can view Stripe webhook events"
ON public.stripe_webhook_events
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created_at
  ON public.stripe_webhook_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON public.stripe_webhook_events(processing_status, environment);
