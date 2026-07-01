-- Idempotent creation of webhook idempotency ledger and refund audit table.
-- Previously defined in 20260701010000 and 20260701040000 but not present in
-- deployed backend. Uses IF NOT EXISTS throughout so it's safe to re-run.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_refund_id text,
  ADD COLUMN IF NOT EXISTS refunded_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_status text;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_refund_status_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_refund_status_check
  CHECK (refund_status IS NULL OR refund_status IN ('requested','succeeded','failed','partial'));

-- 1) Webhook idempotency + observability ledger
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  processing_status text NOT NULL DEFAULT 'processing'
    CHECK (processing_status IN ('processing','processed','failed','ignored')),
  payload jsonb,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view webhook events" ON public.stripe_webhook_events;
CREATE POLICY "Admins can view webhook events"
  ON public.stripe_webhook_events
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at
  ON public.stripe_webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status_env
  ON public.stripe_webhook_events(processing_status, environment);

-- 2) Refund audit trail
CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','succeeded','failed')),
  reason text,
  stripe_refund_id text,
  admin_id uuid REFERENCES auth.users(id),
  admin_notes text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payment_refunds TO authenticated;
GRANT ALL ON public.payment_refunds TO service_role;

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage payment refunds" ON public.payment_refunds;
CREATE POLICY "Admins manage payment refunds"
  ON public.payment_refunds
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS update_payment_refunds_updated_at ON public.payment_refunds;
CREATE TRIGGER update_payment_refunds_updated_at
  BEFORE UPDATE ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment ON public.payment_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_order ON public.payment_refunds(order_id);