
-- ============================================================
-- M1: Bidder verification & commitment foundation
-- ============================================================

-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.bidder_status AS ENUM (
    'unverified',
    'email_verified',
    'phone_verified',
    'payment_method_added',
    'verified_bidder',
    'trusted_bidder',
    'restricted',
    'banned'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. bidder_verifications
CREATE TABLE IF NOT EXISTS public.bidder_verifications (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.bidder_status NOT NULL DEFAULT 'unverified',
  stripe_customer_id text,
  stripe_payment_method_id text,
  payment_method_brand text,
  payment_method_last4 text,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  payment_method_verified_at timestamptz,
  auction_terms_accepted_at timestamptz,
  auction_terms_version text,
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
  failed_payment_count integer NOT NULL DEFAULT 0,
  unpaid_auction_count integer NOT NULL DEFAULT 0,
  restricted_reason text,
  restricted_by uuid REFERENCES auth.users(id),
  restricted_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.bidder_verifications TO authenticated;
GRANT ALL ON public.bidder_verifications TO service_role;

ALTER TABLE public.bidder_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bv_self_select" ON public.bidder_verifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "bv_self_insert" ON public.bidder_verifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users may update their own verification, BUT not restriction/ban fields.
-- A second trigger below blocks privileged columns from non-admins.
CREATE POLICY "bv_self_update" ON public.bidder_verifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER bv_updated_at
  BEFORE UPDATE ON public.bidder_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Protect privileged columns from non-admin updates
CREATE OR REPLACE FUNCTION public.protect_bidder_verification_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_service boolean;
BEGIN
  is_service := (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role';
  IF is_service OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- Non-admins cannot change status to/from restricted|banned|trusted_bidder
  IF NEW.status IS DISTINCT FROM OLD.status
     AND (OLD.status IN ('restricted','banned','trusted_bidder')
          OR NEW.status IN ('restricted','banned','trusted_bidder')) THEN
    RAISE EXCEPTION 'Only admins can change restriction/trust status';
  END IF;
  -- Counters and restriction metadata locked
  NEW.failed_payment_count := OLD.failed_payment_count;
  NEW.unpaid_auction_count := OLD.unpaid_auction_count;
  NEW.restricted_reason := OLD.restricted_reason;
  NEW.restricted_by := OLD.restricted_by;
  NEW.restricted_at := OLD.restricted_at;
  NEW.risk_level := OLD.risk_level;
  NEW.admin_notes := OLD.admin_notes;
  RETURN NEW;
END $$;

CREATE TRIGGER bv_protect_fields
  BEFORE UPDATE ON public.bidder_verifications
  FOR EACH ROW EXECUTE FUNCTION public.protect_bidder_verification_fields();

-- 3. auction_deposit_settings (singleton)
CREATE TABLE IF NOT EXISTS public.auction_deposit_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  thresholds jsonb NOT NULL DEFAULT '[]'::jsonb,
  trusted_waived boolean NOT NULL DEFAULT true,
  auto_charge_winner boolean NOT NULL DEFAULT false,
  winner_payment_deadline_hours integer NOT NULL DEFAULT 24,
  current_terms_version text NOT NULL DEFAULT '2026-06-27-beta',
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auction_deposit_settings TO authenticated, anon;
GRANT ALL ON public.auction_deposit_settings TO service_role;

ALTER TABLE public.auction_deposit_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_read_all" ON public.auction_deposit_settings
  FOR SELECT USING (true);

CREATE POLICY "ads_admin_write" ON public.auction_deposit_settings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.auction_deposit_settings (singleton, enabled, thresholds, trusted_waived, auto_charge_winner)
VALUES (
  true,
  false,
  '[
    {"max_invoice": 250,   "fee": 0},
    {"max_invoice": 1000,  "fee": 25},
    {"max_invoice": 2500,  "fee": 100},
    {"max_invoice": 5000,  "fee": 250},
    {"max_invoice": 10000, "fee": 500},
    {"max_invoice": null,  "fee": 1000}
  ]'::jsonb,
  true,
  false
)
ON CONFLICT (singleton) DO NOTHING;

-- 4. auction_deposits
CREATE TABLE IF NOT EXISTS public.auction_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lot_id uuid NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'required'
    CHECK (status IN ('not_required','required','authorized','charged',
                      'applied_to_order','refunded','released','forfeited','failed')),
  stripe_payment_intent_id text,
  stripe_setup_intent_id text,
  payment_method_id text,
  expires_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auction_deposits_user ON public.auction_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_auction_deposits_lot ON public.auction_deposits(lot_id);
CREATE INDEX IF NOT EXISTS idx_auction_deposits_status ON public.auction_deposits(status);

GRANT SELECT ON public.auction_deposits TO authenticated;
GRANT ALL ON public.auction_deposits TO service_role;

ALTER TABLE public.auction_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dep_self_select" ON public.auction_deposits
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.lots l
      JOIN public.clearance_events ce ON ce.id = l.event_id
      WHERE l.id = auction_deposits.lot_id
        AND public.is_org_member(auth.uid(), ce.org_id)
    )
  );

CREATE TRIGGER ad_updated_at
  BEFORE UPDATE ON public.auction_deposits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. bidder_audit_log
CREATE TABLE IF NOT EXISTS public.bidder_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text,
  lot_id uuid REFERENCES public.lots(id) ON DELETE SET NULL,
  bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bal_user ON public.bidder_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_bal_created ON public.bidder_audit_log(created_at DESC);

GRANT SELECT ON public.bidder_audit_log TO authenticated;
GRANT ALL ON public.bidder_audit_log TO service_role;

ALTER TABLE public.bidder_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bal_self_or_admin" ON public.bidder_audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- 6. Helper functions

CREATE OR REPLACE FUNCTION public.get_bidder_status(_user_id uuid)
RETURNS public.bidder_status
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status FROM public.bidder_verifications WHERE user_id = _user_id),
    'unverified'::public.bidder_status
  )
$$;

CREATE OR REPLACE FUNCTION public.required_deposit_for(_amount numeric, _user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  tier jsonb;
  fee numeric := 0;
  st public.bidder_status;
BEGIN
  SELECT * INTO s FROM public.auction_deposit_settings WHERE singleton = true;
  IF NOT FOUND OR NOT s.enabled THEN
    RETURN 0;
  END IF;
  st := public.get_bidder_status(_user_id);
  IF st = 'trusted_bidder' AND s.trusted_waived THEN
    RETURN 0;
  END IF;
  FOR tier IN SELECT * FROM jsonb_array_elements(s.thresholds) LOOP
    IF (tier->>'max_invoice') IS NULL OR _amount <= (tier->>'max_invoice')::numeric THEN
      fee := COALESCE((tier->>'fee')::numeric, 0);
      EXIT;
    END IF;
  END LOOP;
  RETURN fee;
END $$;

CREATE OR REPLACE FUNCTION public.can_user_bid(_user_id uuid, _lot_id uuid)
RETURNS TABLE(allowed boolean, reason text, required_deposit numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v record;
  lot record;
  current_terms text;
  current_price numeric;
  is_service boolean;
BEGIN
  is_service := (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role';

  -- Lot must exist and be a live auction
  SELECT id, pricing_type, status, auction_end, current_bid, start_price, event_id
    INTO lot FROM public.lots WHERE id = _lot_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'lot_not_found', 0::numeric; RETURN;
  END IF;
  IF lot.pricing_type <> 'auction' THEN
    RETURN QUERY SELECT false, 'not_an_auction', 0::numeric; RETURN;
  END IF;
  IF lot.status <> 'active' THEN
    RETURN QUERY SELECT false, 'auction_not_active', 0::numeric; RETURN;
  END IF;
  IF lot.auction_end IS NOT NULL AND lot.auction_end < now() THEN
    RETURN QUERY SELECT false, 'auction_ended', 0::numeric; RETURN;
  END IF;

  -- Verification
  SELECT * INTO v FROM public.bidder_verifications WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'verification_required', 0::numeric; RETURN;
  END IF;
  IF v.status IN ('banned','restricted') THEN
    RETURN QUERY SELECT false, ('account_'||v.status::text), 0::numeric; RETURN;
  END IF;

  -- Terms acceptance against the current version
  SELECT current_terms_version INTO current_terms FROM public.auction_deposit_settings WHERE singleton=true;
  IF v.auction_terms_accepted_at IS NULL OR v.auction_terms_version IS DISTINCT FROM current_terms THEN
    RETURN QUERY SELECT false, 'terms_acceptance_required', 0::numeric; RETURN;
  END IF;

  -- Payment method gate. In M1 we soft-allow if the global flag is off.
  IF v.stripe_payment_method_id IS NULL THEN
    -- M1 interim: allow but signal pending. M2 flip: hard reject.
    -- The signal is delivered via `reason` so UI can show the banner.
    -- Continue; do not return here.
    NULL;
  END IF;

  -- Outstanding defaults
  IF v.unpaid_auction_count > 0 THEN
    RETURN QUERY SELECT false, 'unpaid_previous_auction', 0::numeric; RETURN;
  END IF;

  current_price := COALESCE(lot.current_bid, lot.start_price, 0);

  RETURN QUERY SELECT
    true,
    CASE WHEN v.stripe_payment_method_id IS NULL
         THEN 'ok_payment_method_pending'
         ELSE 'ok' END,
    public.required_deposit_for(current_price, _user_id);
END $$;

-- 7. Backstop trigger on bids
CREATE OR REPLACE FUNCTION public.enforce_bidder_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res record;
  is_service boolean;
BEGIN
  is_service := (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role';
  -- Service role (edge functions) already validated via can_user_bid; still run as a backstop.
  SELECT * INTO res FROM public.can_user_bid(NEW.user_id, NEW.lot_id);
  IF NOT res.allowed THEN
    RAISE EXCEPTION 'Bid rejected: %', res.reason USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bids_enforce_eligibility ON public.bids;
CREATE TRIGGER trg_bids_enforce_eligibility
  BEFORE INSERT ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.enforce_bidder_eligibility();

-- 8. Grandfather existing bidders
INSERT INTO public.bidder_verifications (user_id, status, email_verified_at, created_at, updated_at)
SELECT DISTINCT b.user_id, 'verified_bidder'::public.bidder_status, now(), now(), now()
FROM public.bids b
WHERE b.user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 9. Auto-seed a row on new auth user (so first-time UI has somewhere to write)
CREATE OR REPLACE FUNCTION public.handle_new_user_bidder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.bidder_verifications (user_id, status, email_verified_at)
  VALUES (
    NEW.id,
    CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN 'email_verified'::public.bidder_status
         ELSE 'unverified'::public.bidder_status END,
    NEW.email_confirmed_at
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_bidder ON auth.users;
CREATE TRIGGER on_auth_user_created_bidder
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_bidder();

-- 10. Admin RPCs for restriction lifecycle
CREATE OR REPLACE FUNCTION public.admin_set_bidder_status(_user_id uuid, _status public.bidder_status, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.bidder_verifications (user_id, status)
  VALUES (_user_id, _status)
  ON CONFLICT (user_id) DO UPDATE SET
    status = _status,
    restricted_reason = CASE WHEN _status IN ('restricted','banned') THEN _reason ELSE NULL END,
    restricted_by = CASE WHEN _status IN ('restricted','banned') THEN auth.uid() ELSE NULL END,
    restricted_at = CASE WHEN _status IN ('restricted','banned') THEN now() ELSE NULL END,
    updated_at = now();
  INSERT INTO public.bidder_audit_log (user_id, actor_id, action, reason, metadata)
  VALUES (_user_id, auth.uid(), 'status_change:'||_status::text, _reason, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.accept_auction_terms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid; v_version text;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT current_terms_version INTO v_version FROM public.auction_deposit_settings WHERE singleton=true;
  INSERT INTO public.bidder_verifications (user_id, status, auction_terms_accepted_at, auction_terms_version, email_verified_at)
  VALUES (v_user, 'email_verified', now(), v_version, now())
  ON CONFLICT (user_id) DO UPDATE SET
    auction_terms_accepted_at = now(),
    auction_terms_version = v_version,
    updated_at = now();
END $$;
