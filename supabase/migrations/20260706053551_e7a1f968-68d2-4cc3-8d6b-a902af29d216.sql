ALTER TABLE public.bidder_verifications
  ADD COLUMN IF NOT EXISTS payment_method_environment text;

ALTER TABLE public.bidder_verifications
  DROP CONSTRAINT IF EXISTS bidder_verifications_payment_method_environment_check;

ALTER TABLE public.bidder_verifications
  ADD CONSTRAINT bidder_verifications_payment_method_environment_check
  CHECK (payment_method_environment IS NULL OR payment_method_environment IN ('sandbox', 'live'));

CREATE TABLE IF NOT EXISTS public.bidder_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('sandbox', 'live')),
  stripe_customer_id text NOT NULL,
  stripe_payment_method_id text,
  payment_method_brand text,
  payment_method_last4 text,
  payment_method_verified_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, environment)
);

GRANT SELECT ON public.bidder_payment_methods TO authenticated;
GRANT ALL ON public.bidder_payment_methods TO service_role;

ALTER TABLE public.bidder_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bidder_payment_methods_self_select" ON public.bidder_payment_methods;
CREATE POLICY "bidder_payment_methods_self_select"
  ON public.bidder_payment_methods
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS bidder_payment_methods_updated_at ON public.bidder_payment_methods;
CREATE TRIGGER bidder_payment_methods_updated_at
  BEFORE UPDATE ON public.bidder_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_user_bid_for_environment(
  _user_id uuid,
  _lot_id uuid,
  _environment text
)
RETURNS TABLE(allowed boolean, reason text, required_deposit numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v record;
  lot record;
  settings record;
  active_pm record;
  current_terms text;
  current_price numeric;
  required numeric;
  active_deposit record;
  gateway text;
BEGIN
  IF _environment NOT IN ('sandbox', 'live') THEN
    RETURN QUERY SELECT false, 'payment_method_required', 0::numeric;
    RETURN;
  END IF;

  gateway := CASE WHEN _environment = 'live' THEN 'lovable_gateway_live' ELSE 'lovable_gateway_sandbox' END;

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

  SELECT * INTO active_pm
    FROM public.bidder_payment_methods
    WHERE user_id = _user_id
      AND environment = _environment
      AND is_active = true
      AND stripe_customer_id IS NOT NULL
      AND stripe_payment_method_id IS NOT NULL
    LIMIT 1;

  IF NOT FOUND THEN
    IF v.stripe_customer_id IS NULL
       OR v.stripe_payment_method_id IS NULL
       OR COALESCE(v.payment_method_environment, _environment) <> _environment THEN
      RETURN QUERY SELECT false,'payment_method_required',0::numeric; RETURN;
    END IF;
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
        AND gateway_mode = gateway
      ORDER BY created_at DESC
      LIMIT 1;
    IF NOT FOUND THEN
      RETURN QUERY SELECT false,'deposit_required',required; RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT true,'ok',required;
END $$;

GRANT EXECUTE ON FUNCTION public.can_user_bid_for_environment(uuid, uuid, text) TO authenticated, service_role;