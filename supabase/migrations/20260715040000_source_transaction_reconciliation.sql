-- Link separate seller transfers to their originating Stripe charge and expose
-- an admin-only accounting trail. This migration does not create transfers or
-- change payment/payout feature flags.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_charge_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS stripe_charge_currency text,
  ADD COLUMN IF NOT EXISTS stripe_balance_transaction_id text,
  ADD COLUMN IF NOT EXISTS stripe_charge_available_on timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_charge_settlement_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS payout_processing_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payout_last_error text,
  ADD COLUMN IF NOT EXISTS payout_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_source_transaction_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_transfer_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS tax_calculation_status text NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS buyer_fee_tax_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS seller_fee_tax_amount numeric(12,2);

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_charge_settlement_status_check,
  DROP CONSTRAINT IF EXISTS payments_payout_processing_status_check,
  DROP CONSTRAINT IF EXISTS payments_tax_calculation_status_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_charge_settlement_status_check CHECK (
    stripe_charge_settlement_status IN ('unknown', 'pending', 'available')
  ),
  ADD CONSTRAINT payments_payout_processing_status_check CHECK (
    payout_processing_status IN (
      'pending', 'processing', 'awaiting_stripe_settlement',
      'transferred', 'failed', 'on_hold'
    )
  ),
  ADD CONSTRAINT payments_tax_calculation_status_check CHECK (
    tax_calculation_status IN ('not_configured', 'calculated', 'review_required')
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_transfer_id_unique
  ON public.payments(stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_stripe_charge_id
  ON public.payments(stripe_charge_id)
  WHERE stripe_charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_payout_processing
  ON public.payments(payout_processing_status, manual_payout_status)
  WHERE stripe_transfer_id IS NULL;

CREATE TABLE IF NOT EXISTS public.payment_transfer_reconciliation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  event_type text NOT NULL CHECK (event_type IN (
    'charge_recorded', 'charge_reconciled', 'transfer_attempted',
    'transfer_created', 'transfer_failed', 'transfer_skipped',
    'manual_status_update'
  )),
  outcome text NOT NULL CHECK (outcome IN (
    'recorded', 'processing', 'accepted', 'failed', 'skipped'
  )),
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  idempotency_key text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_balance_transaction_id text,
  stripe_transfer_id text,
  stripe_destination_account_id text,
  source_transaction_used boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'aud',
  buyer_charge_amount numeric(12,2),
  base_amount numeric(12,2),
  buyer_fee numeric(12,2),
  seller_fee numeric(12,2),
  seller_payout numeric(12,2),
  buyer_fee_tax_amount numeric(12,2),
  seller_fee_tax_amount numeric(12,2),
  tax_calculation_status text NOT NULL DEFAULT 'not_configured',
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_transfer_reconciliation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view payment transfer reconciliation"
  ON public.payment_transfer_reconciliation;
CREATE POLICY "Admins can view payment transfer reconciliation"
  ON public.payment_transfer_reconciliation
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

REVOKE ALL ON public.payment_transfer_reconciliation FROM anon, authenticated;
GRANT SELECT ON public.payment_transfer_reconciliation TO authenticated;
GRANT ALL ON public.payment_transfer_reconciliation TO service_role;

CREATE INDEX IF NOT EXISTS idx_payment_transfer_reconciliation_payment
  ON public.payment_transfer_reconciliation(payment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transfer_reconciliation_order
  ON public.payment_transfer_reconciliation(order_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transfer_reconciliation_transfer
  ON public.payment_transfer_reconciliation(stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL AND event_type = 'transfer_created';

DROP VIEW IF EXISTS public.admin_payment_reconciliation;
CREATE VIEW public.admin_payment_reconciliation
WITH (security_invoker = true) AS
SELECT
  p.id AS payment_id,
  p.order_id,
  p.created_at AS payment_created_at,
  p.updated_at AS payment_updated_at,
  p.environment,
  p.status AS payment_status,
  p.payment_method,
  p.payment_mode,
  p.manual_payout_status,
  p.payout_processing_status,
  p.payout_attempt_count,
  p.payout_last_attempt_at,
  p.payout_last_error,
  p.payout_source_transaction_used,
  p.base_amount,
  p.buyer_fee,
  p.seller_fee,
  p.amount_charged,
  p.seller_payout,
  (p.buyer_fee + p.seller_fee) AS platform_fee_total,
  p.refunded_amount,
  p.refund_status,
  p.tax_calculation_status,
  p.buyer_fee_tax_amount,
  p.seller_fee_tax_amount,
  p.stripe_session_id,
  p.stripe_payment_intent_id,
  p.stripe_charge_id,
  p.stripe_charge_amount,
  p.stripe_charge_currency,
  p.stripe_balance_transaction_id,
  p.stripe_charge_available_on,
  p.stripe_charge_settlement_status,
  p.stripe_transfer_id,
  p.stripe_transfer_created_at,
  ssa.stripe_account_id AS seller_stripe_account_id,
  o.status AS order_status,
  o.pickup_status,
  o.buyer_id,
  bp.full_name AS buyer_name,
  bp.email AS buyer_email,
  l.id AS lot_id,
  l.title AS lot_title,
  ce.org_id AS seller_org_id,
  org.name AS seller_name,
  latest_attempt.event_type AS latest_event_type,
  latest_attempt.outcome AS latest_event_outcome,
  latest_attempt.error_code AS latest_error_code,
  latest_attempt.error_message AS latest_error_message,
  latest_attempt.created_at AS latest_event_at
FROM public.payments p
JOIN public.orders o ON o.id = p.order_id
LEFT JOIN public.profiles bp ON bp.id = o.buyer_id
LEFT JOIN public.lots l ON l.id = o.lot_id
LEFT JOIN public.clearance_events ce ON ce.id = o.event_id
LEFT JOIN public.organizations org ON org.id = ce.org_id
LEFT JOIN public.seller_stripe_accounts ssa ON ssa.org_id = ce.org_id
LEFT JOIN LATERAL (
  SELECT r.event_type, r.outcome, r.error_code, r.error_message, r.created_at
  FROM public.payment_transfer_reconciliation r
  WHERE r.payment_id = p.id
  ORDER BY r.created_at DESC
  LIMIT 1
) latest_attempt ON true
WHERE public.is_admin(auth.uid());

GRANT SELECT ON public.admin_payment_reconciliation TO authenticated;

-- Automated/Connect payouts may only be marked paid after Stripe has returned a
-- real Transfer object. Admins retain pending, hold and failed controls.
CREATE OR REPLACE FUNCTION public.admin_set_payout_status(
  _payment_id uuid,
  _status text,
  _reference text DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.payments%ROWTYPE;
  ord public.orders%ROWTYPE;
  seller_org uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN (
    'manual_payout_pending', 'manual_payout_paid',
    'manual_payout_on_hold', 'manual_payout_failed'
  ) THEN
    RAISE EXCEPTION 'Invalid payout status';
  END IF;

  SELECT * INTO p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  SELECT * INTO ord FROM public.orders WHERE id = p.order_id;
  SELECT ce.org_id INTO seller_org
  FROM public.clearance_events ce WHERE ce.id = ord.event_id;

  IF _status = 'manual_payout_paid' THEN
    IF p.status <> 'succeeded' THEN
      RAISE EXCEPTION 'Cannot mark payout paid: payment is %', p.status;
    END IF;
    IF ord.status <> 'collected' THEN
      RAISE EXCEPTION 'Cannot mark payout paid: order is %', ord.status;
    END IF;
    IF p.stripe_transfer_id IS NULL OR p.stripe_transfer_id !~ '^tr_' THEN
      RAISE EXCEPTION 'Cannot mark payout paid without a real Stripe Transfer ID';
    END IF;
  END IF;

  UPDATE public.payments SET
    manual_payout_status = _status::public.manual_payout_status,
    manual_payout_reference = CASE
      WHEN _status = 'manual_payout_paid' THEN stripe_transfer_id
      ELSE COALESCE(_reference, manual_payout_reference)
    END,
    admin_notes = CASE WHEN _note IS NULL THEN admin_notes
      ELSE COALESCE(admin_notes || E'\n', '') || _note END,
    manual_payout_paid_at = CASE
      WHEN _status = 'manual_payout_paid' THEN COALESCE(manual_payout_paid_at, now())
      ELSE NULL
    END,
    payout_processing_status = CASE
      WHEN _status = 'manual_payout_on_hold' THEN 'on_hold'
      WHEN _status = 'manual_payout_failed' THEN 'failed'
      WHEN _status = 'manual_payout_paid' AND stripe_charge_settlement_status = 'pending'
        THEN 'awaiting_stripe_settlement'
      WHEN _status = 'manual_payout_paid' THEN 'transferred'
      ELSE 'pending'
    END,
    updated_at = now()
  WHERE id = _payment_id;

  INSERT INTO public.payment_transfer_reconciliation (
    payment_id, order_id, seller_org_id, event_type, outcome, environment,
    stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id,
    source_transaction_used, buyer_charge_amount, base_amount, buyer_fee,
    seller_fee, seller_payout, buyer_fee_tax_amount, seller_fee_tax_amount,
    tax_calculation_status, metadata
  ) VALUES (
    p.id, p.order_id, seller_org, 'manual_status_update', 'recorded',
    COALESCE(p.environment, 'sandbox'),
    p.stripe_payment_intent_id, p.stripe_charge_id, p.stripe_transfer_id,
    p.payout_source_transaction_used, p.amount_charged, p.base_amount, p.buyer_fee,
    p.seller_fee, p.seller_payout, p.buyer_fee_tax_amount, p.seller_fee_tax_amount,
    p.tax_calculation_status,
    jsonb_build_object('status', _status, 'note', _note, 'admin_user_id', auth.uid())
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_payout_status(uuid,text,text,text)
  FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_set_payout_status(uuid,text,text,text)
  TO authenticated;

-- Guarded reconciliation for the supplied live transaction. No payout or
-- transfer status is changed and no Stripe object is created here.
WITH reconciled AS (
  UPDATE public.payments
  SET
    stripe_charge_id = 'ch_3TqPMbELbxGcXLeZ1mCzEltA',
    stripe_charge_amount = amount_charged,
    stripe_charge_currency = 'aud',
    stripe_charge_settlement_status = 'unknown',
    payout_processing_status = CASE
      WHEN stripe_transfer_id IS NULL THEN 'pending'
      ELSE payout_processing_status
    END,
    updated_at = now()
  WHERE stripe_payment_intent_id = 'pi_3TqPMbELbxGcXLeZ1f3V3XhD'
    AND environment = 'live'
    AND stripe_charge_id IS NULL
    AND stripe_transfer_id IS NULL
    AND amount_charged = 5.50
  RETURNING *
)
INSERT INTO public.payment_transfer_reconciliation (
  payment_id, order_id, seller_org_id, event_type, outcome, environment,
  stripe_payment_intent_id, stripe_charge_id, currency, buyer_charge_amount,
  base_amount, buyer_fee, seller_fee, seller_payout, tax_calculation_status,
  metadata
)
SELECT
  p.id, p.order_id, ce.org_id, 'charge_reconciled', 'recorded', p.environment,
  p.stripe_payment_intent_id, p.stripe_charge_id, 'aud', p.amount_charged,
  p.base_amount, p.buyer_fee, p.seller_fee, p.seller_payout,
  p.tax_calculation_status,
  jsonb_build_object('reason', 'Owner-supplied live Stripe charge reconciliation')
FROM reconciled p
JOIN public.orders o ON o.id = p.order_id
JOIN public.clearance_events ce ON ce.id = o.event_id;
