-- Payment launch hardening:
-- - single webhook ledger / idempotency table
-- - refund audit table
-- - auction winner automatic charge audit fields
-- - payment refund/transfer tracking fields
-- - stricter bidder card gate before bidding

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'cancelled'
      AND enumtypid = 'public.payment_status'::regtype
  ) THEN
    ALTER TYPE public.payment_status ADD VALUE 'cancelled';
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS auction_payment_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS auction_payment_error text;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_refund_id text,
  ADD COLUMN IF NOT EXISTS refunded_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_status text;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_refund_status_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_refund_status_check
  CHECK (refund_status IS NULL OR refund_status IN ('requested','succeeded','failed','partial'));

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  processing_status text NOT NULL DEFAULT 'processing'
    CHECK (processing_status IN ('processing','processed','failed','ignored')),
  payload jsonb,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view webhook events" ON public.stripe_webhook_events;
CREATE POLICY "Admins can view webhook events"
  ON public.stripe_webhook_events
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;

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

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage payment refunds" ON public.payment_refunds;
CREATE POLICY "Admins manage payment refunds"
  ON public.payment_refunds
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_payment_refunds_updated_at
  BEFORE UPDATE ON public.payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE ON public.payment_refunds TO authenticated;
GRANT ALL ON public.payment_refunds TO service_role;

CREATE OR REPLACE VIEW public.admin_payment_integrity AS
SELECT
  p.id AS payment_id,
  p.order_id,
  p.status AS payment_status,
  p.payment_mode,
  p.manual_payout_status,
  p.amount_charged,
  p.seller_payout,
  p.refunded_amount,
  p.refund_status,
  p.stripe_session_id,
  p.stripe_payment_intent_id,
  p.stripe_transfer_id,
  o.status AS order_status,
  o.pickup_status,
  EXISTS (
    SELECT 1 FROM public.lot_reports r
    WHERE r.order_id = p.order_id
      AND r.status IN ('open','investigating')
  ) AS has_open_issue,
  CASE
    WHEN p.status = 'succeeded'
      AND p.manual_payout_status = 'manual_payout_paid'
      AND p.stripe_transfer_id IS NULL
      AND p.payment_mode = 'stripe_connect_mode'
      THEN 'automatic_payout_missing_transfer_id'
    WHEN p.status <> 'succeeded'
      AND p.manual_payout_status = 'manual_payout_paid'
      THEN 'payout_paid_without_successful_payment'
    WHEN p.status = 'refunded'
      AND p.manual_payout_status = 'manual_payout_paid'
      THEN 'refunded_after_payout_paid'
    WHEN p.status = 'succeeded'
      AND EXISTS (
        SELECT 1 FROM public.lot_reports r
        WHERE r.order_id = p.order_id
          AND r.status IN ('open','investigating')
      )
      AND p.manual_payout_status = 'manual_payout_pending'
      THEN 'open_issue_should_hold_payout'
    ELSE NULL
  END AS issue
FROM public.payments p
JOIN public.orders o ON o.id = p.order_id
WHERE public.is_admin(auth.uid());

ALTER VIEW public.admin_payment_integrity SET (security_invoker = true);
GRANT SELECT ON public.admin_payment_integrity TO authenticated;

-- Hard gate bidding on a saved payment method, current auction terms, and a clean
-- bidder account. This replaces the earlier soft "ok_payment_method_pending" mode.
CREATE OR REPLACE FUNCTION public.can_user_bid(_user_id uuid, _lot_id uuid)
RETURNS TABLE(allowed boolean, reason text, required_deposit numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v record; lot record; settings record;
  current_terms text; current_price numeric; required numeric;
  active_deposit record;
BEGIN
  SELECT id, pricing_type, status, auction_end, current_bid, start_price, event_id
    INTO lot FROM public.lots WHERE id = _lot_id;
  IF NOT FOUND THEN RETURN QUERY SELECT false,'lot_not_found',0::numeric; RETURN; END IF;
  IF lot.pricing_type <> 'auction' THEN RETURN QUERY SELECT false,'not_an_auction',0::numeric; RETURN; END IF;
  IF lot.status <> 'active' THEN RETURN QUERY SELECT false,'auction_not_active',0::numeric; RETURN; END IF;
  IF lot.auction_end IS NOT NULL AND lot.auction_end < now() THEN
    RETURN QUERY SELECT false,'auction_ended',0::numeric; RETURN;
  END IF;

  SELECT * INTO v FROM public.bidder_verifications WHERE user_id = _user_id;
  IF NOT FOUND THEN RETURN QUERY SELECT false,'verification_required',0::numeric; RETURN; END IF;
  IF v.status IN ('banned','restricted') THEN
    RETURN QUERY SELECT false,('account_'||v.status::text),0::numeric; RETURN;
  END IF;

  IF v.stripe_customer_id IS NULL OR v.stripe_payment_method_id IS NULL THEN
    RETURN QUERY SELECT false,'payment_method_required',0::numeric; RETURN;
  END IF;

  SELECT * INTO settings FROM public.auction_deposit_settings WHERE singleton = true;
  current_terms := settings.current_terms_version;
  IF v.auction_terms_accepted_at IS NULL OR v.auction_terms_version IS DISTINCT FROM current_terms THEN
    RETURN QUERY SELECT false,'terms_acceptance_required',0::numeric; RETURN;
  END IF;

  IF v.status NOT IN ('verified_bidder','trusted_bidder') THEN
    RETURN QUERY SELECT false,'verification_required',0::numeric; RETURN;
  END IF;

  IF v.unpaid_auction_count > 0 THEN
    RETURN QUERY SELECT false,'unpaid_previous_auction',0::numeric; RETURN;
  END IF;

  current_price := COALESCE(lot.current_bid, lot.start_price, 0);
  required := public.required_deposit_for(current_price, _user_id);

  IF required > 0 THEN
    SELECT * INTO active_deposit
      FROM public.auction_deposits
      WHERE user_id = _user_id
        AND lot_id = _lot_id
        AND purpose = 'bid_hold'
        AND status IN ('authorized','charged','applied_to_order')
        AND amount >= required
      ORDER BY created_at DESC
      LIMIT 1;
    IF NOT FOUND THEN
      RETURN QUERY SELECT false,'deposit_required',required; RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT true,'ok',required;
END $$;

GRANT EXECUTE ON FUNCTION public.can_user_bid(uuid, uuid) TO authenticated, service_role;
