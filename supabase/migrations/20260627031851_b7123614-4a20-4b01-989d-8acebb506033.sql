
-- 1. Extend bidder_status enum (additive only, safe)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='payment_method_required' AND enumtypid='public.bidder_status'::regtype) THEN
    ALTER TYPE public.bidder_status ADD VALUE 'payment_method_required';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='auction_terms_accepted' AND enumtypid='public.bidder_status'::regtype) THEN
    ALTER TYPE public.bidder_status ADD VALUE 'auction_terms_accepted';
  END IF;
END $$;

-- 2. Platform payment-gateway mode (text setting, not the per-payment enum)
ALTER TABLE public.auction_deposit_settings
  ADD COLUMN IF NOT EXISTS current_gateway_mode text NOT NULL DEFAULT 'lovable_gateway_sandbox';
ALTER TABLE public.auction_deposit_settings
  DROP CONSTRAINT IF EXISTS auction_deposit_settings_gateway_mode_check;
ALTER TABLE public.auction_deposit_settings
  ADD CONSTRAINT auction_deposit_settings_gateway_mode_check
  CHECK (current_gateway_mode IN ('lovable_gateway_sandbox','lovable_gateway_live','stripe_connect_future'));

-- 3. auction_deposits: add columns + expand status
ALTER TABLE public.auction_deposits
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'bid_hold',
  ADD COLUMN IF NOT EXISTS tier_band text,
  ADD COLUMN IF NOT EXISTS gateway_mode text NOT NULL DEFAULT 'lovable_gateway_sandbox',
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text;

ALTER TABLE public.auction_deposits
  DROP CONSTRAINT IF EXISTS auction_deposits_purpose_check;
ALTER TABLE public.auction_deposits
  ADD CONSTRAINT auction_deposits_purpose_check
  CHECK (purpose IN ('bid_hold','default_fee','refund'));

ALTER TABLE public.auction_deposits DROP CONSTRAINT IF EXISTS auction_deposits_status_check;
ALTER TABLE public.auction_deposits
  ADD CONSTRAINT auction_deposits_status_check
  CHECK (status IN (
    'not_required','required','authorized','charged','applied_to_order',
    'refunded','released','forfeited','failed','scaffolded_unsupported'
  ));

CREATE INDEX IF NOT EXISTS idx_auction_deposits_user_lot
  ON public.auction_deposits(user_id, lot_id, created_at DESC);

-- 4. Seed/update settings (enable deposits, correct $75 tier, sandbox mode)
UPDATE public.auction_deposit_settings
  SET enabled = true,
      auto_charge_winner = true,
      current_gateway_mode = 'lovable_gateway_sandbox',
      thresholds = '[
        {"fee": 0,    "max_invoice": 250,   "band": "t0"},
        {"fee": 25,   "max_invoice": 1000,  "band": "t1"},
        {"fee": 75,   "max_invoice": 2500,  "band": "t2"},
        {"fee": 250,  "max_invoice": 5000,  "band": "t3"},
        {"fee": 500,  "max_invoice": 10000, "band": "t4"},
        {"fee": 1000, "max_invoice": null,  "band": "t5"}
      ]'::jsonb,
      updated_at = now()
  WHERE singleton = true;

-- 5. Helper: tier band for an amount
CREATE OR REPLACE FUNCTION public.deposit_tier_band(_amount numeric)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s record; tier jsonb;
BEGIN
  SELECT * INTO s FROM public.auction_deposit_settings WHERE singleton = true;
  IF NOT FOUND THEN RETURN 't0'; END IF;
  FOR tier IN SELECT * FROM jsonb_array_elements(s.thresholds) LOOP
    IF (tier->>'max_invoice') IS NULL OR _amount <= (tier->>'max_invoice')::numeric THEN
      RETURN COALESCE(tier->>'band', 't0');
    END IF;
  END LOOP;
  RETURN 't5';
END $$;

-- 6. Update can_user_bid: require verified_bidder/trusted_bidder + check deposit
CREATE OR REPLACE FUNCTION public.can_user_bid(_user_id uuid, _lot_id uuid)
RETURNS TABLE(allowed boolean, reason text, required_deposit numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v record; lot record; settings record;
  current_terms text; current_price numeric; required numeric; band text;
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

  IF v.stripe_payment_method_id IS NULL THEN
    RETURN QUERY SELECT false,'payment_method_required',0::numeric; RETURN;
  END IF;

  SELECT * INTO settings FROM public.auction_deposit_settings WHERE singleton=true;
  current_terms := settings.current_terms_version;
  IF v.auction_terms_accepted_at IS NULL OR v.auction_terms_version IS DISTINCT FROM current_terms THEN
    RETURN QUERY SELECT false,'terms_acceptance_required',0::numeric; RETURN;
  END IF;

  IF v.status NOT IN ('verified_bidder','trusted_bidder') THEN
    -- All onboarding signals satisfied but status hasn't been advanced: treat as terms_acceptance
    -- so the UI re-runs accept_auction_terms which now auto-promotes.
    RETURN QUERY SELECT false,'verification_required',0::numeric; RETURN;
  END IF;

  IF v.unpaid_auction_count > 0 THEN
    RETURN QUERY SELECT false,'unpaid_previous_auction',0::numeric; RETURN;
  END IF;

  current_price := COALESCE(lot.current_bid, lot.start_price, 0);
  required := public.required_deposit_for(current_price, _user_id);
  band := public.deposit_tier_band(current_price);

  IF required > 0 THEN
    SELECT * INTO active_deposit
      FROM public.auction_deposits
      WHERE user_id = _user_id AND lot_id = _lot_id AND purpose='bid_hold'
        AND status IN ('authorized','charged','applied_to_order')
        AND amount >= required
      ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN
      RETURN QUERY SELECT false,'deposit_required',required; RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT true,'ok',required;
END $$;

-- 7. accept_auction_terms: auto-promote status
CREATE OR REPLACE FUNCTION public.accept_auction_terms()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid; v_version text; existing record; new_status public.bidder_status;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT current_terms_version INTO v_version FROM public.auction_deposit_settings WHERE singleton=true;

  SELECT * INTO existing FROM public.bidder_verifications WHERE user_id = v_user;

  -- Decide auto-status: if PM on file → verified_bidder, else → auction_terms_accepted
  IF existing.user_id IS NOT NULL AND existing.status = 'trusted_bidder' THEN
    new_status := 'trusted_bidder'::public.bidder_status;
  ELSIF existing.stripe_payment_method_id IS NOT NULL THEN
    new_status := 'verified_bidder'::public.bidder_status;
  ELSE
    new_status := 'auction_terms_accepted'::public.bidder_status;
  END IF;

  INSERT INTO public.bidder_verifications (user_id, status, auction_terms_accepted_at,
    auction_terms_version, email_verified_at)
  VALUES (v_user, new_status, now(), v_version, COALESCE(existing.email_verified_at, now()))
  ON CONFLICT (user_id) DO UPDATE SET
    status = CASE
      WHEN public.bidder_verifications.status IN ('restricted','banned') THEN public.bidder_verifications.status
      ELSE EXCLUDED.status END,
    auction_terms_accepted_at = now(),
    auction_terms_version = v_version,
    updated_at = now();
END $$;

-- 8. Mark a payment method advance helper (callable by service role / future edge fn)
CREATE OR REPLACE FUNCTION public.bidder_mark_payment_method_added(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing record; new_status public.bidder_status;
BEGIN
  SELECT * INTO existing FROM public.bidder_verifications WHERE user_id = _user_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF existing.status IN ('restricted','banned','trusted_bidder') THEN RETURN; END IF;
  IF existing.auction_terms_accepted_at IS NOT NULL THEN
    new_status := 'verified_bidder';
  ELSE
    new_status := 'payment_method_added';
  END IF;
  UPDATE public.bidder_verifications SET status = new_status, updated_at = now()
    WHERE user_id = _user_id;
END $$;

-- 9. Admin: remove a suspicious bid
CREATE OR REPLACE FUNCTION public.admin_remove_bid(_bid_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b record; nextbid record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
  SELECT * INTO b FROM public.bids WHERE id = _bid_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bid not found'; END IF;
  INSERT INTO public.bidder_audit_log (user_id, actor_id, action, reason, metadata)
  VALUES (b.user_id, auth.uid(), 'bid_removed_by_admin', _reason,
          jsonb_build_object('bid_id', b.id, 'lot_id', b.lot_id, 'amount', b.amount));
  DELETE FROM public.bids WHERE id = _bid_id;
  -- Recompute winning / current price for the lot
  SELECT * INTO nextbid FROM public.bids WHERE lot_id = b.lot_id
    ORDER BY amount DESC LIMIT 1;
  UPDATE public.bids SET is_winning = (id = nextbid.id) WHERE lot_id = b.lot_id;
  UPDATE public.lots
    SET current_bid = COALESCE(nextbid.amount, NULL),
        bid_count = GREATEST(0, COALESCE(bid_count,0) - 1),
        updated_at = now()
    WHERE id = b.lot_id;
END $$;

-- 10. Mark deposit outcome (admin)
CREATE OR REPLACE FUNCTION public.mark_deposit_outcome(_deposit_id uuid, _outcome text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
  IF _outcome NOT IN ('refunded','applied_to_order','forfeited','released') THEN
    RAISE EXCEPTION 'Invalid outcome';
  END IF;
  UPDATE public.auction_deposits SET
    status = _outcome,
    released_at = CASE WHEN _outcome IN ('released','refunded') THEN now() ELSE released_at END,
    captured_at = CASE WHEN _outcome IN ('applied_to_order','forfeited') THEN now() ELSE captured_at END,
    admin_notes = COALESCE(admin_notes||E'\n','')||COALESCE(_note,'Outcome set by admin'),
    updated_at = now()
  WHERE id = _deposit_id;
END $$;

-- 11. Offer to next-highest bidder (creates new pending order for runner-up)
CREATE OR REPLACE FUNCTION public.offer_to_next_bidder(_lot_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lot record; runner record; base numeric; fee numeric; total numeric; new_order_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
  SELECT * INTO lot FROM public.lots WHERE id = _lot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lot not found'; END IF;

  SELECT * INTO runner FROM public.bids
    WHERE lot_id = _lot_id AND user_id <> COALESCE(lot.winning_bidder_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ORDER BY amount DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No runner-up bidder available'; END IF;

  base := runner.amount;
  fee := round(base * 0.10, 2);
  total := base + fee;

  INSERT INTO public.orders (lot_id, event_id, buyer_id, buyer_org_id, amount, status, notes, pickup_status)
  VALUES (_lot_id, lot.event_id, runner.user_id, runner.org_id, total, 'pending_payment',
          format('Offered to runner-up: $%s + 10%% fee', base::text), 'awaiting_payment')
  RETURNING id INTO new_order_id;

  UPDATE public.lots
    SET status='reserved', reserved_order_id=new_order_id,
        reserved_until=now()+interval '24 hours', winning_bidder_id=runner.user_id,
        updated_at=now()
    WHERE id=_lot_id;

  PERFORM public.notify_user(runner.user_id, 'auction_won',
    'Item offered to you', format('"%s" is offered to you at $%s. Complete payment within 24h.', lot.title, total::text),
    '/app/orders/'||new_order_id, new_order_id, _lot_id, NULL, NULL, false, 'high');

  RETURN new_order_id;
END $$;

-- 12. Relist auction
CREATE OR REPLACE FUNCTION public.relist_auction(_lot_id uuid, _new_end timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
  IF _new_end < now() THEN RAISE EXCEPTION 'New end must be in the future'; END IF;
  UPDATE public.lots SET status='active', auction_end=_new_end,
    reserved_order_id=NULL, reserved_until=NULL, winning_bidder_id=NULL,
    current_bid=NULL, bid_count=0, updated_at=now()
    WHERE id=_lot_id;
  DELETE FROM public.bids WHERE lot_id=_lot_id;
END $$;

-- 13. Default-handling: per-order
CREATE OR REPLACE FUNCTION public.handle_defaulted_winner(_order_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; dep record; new_failed int; new_status public.bidder_status;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id=_order_id;
  IF NOT FOUND OR o.status <> 'pending_payment' THEN RETURN 'skipped'; END IF;

  -- Cancel order (releases lot via existing trigger)
  UPDATE public.orders SET status='cancelled',
    admin_notes = COALESCE(admin_notes||E'\n','')||'Auto-cancelled: winner did not pay within deadline',
    updated_at = now()
  WHERE id=_order_id;

  -- Capture held deposit as default fee, if any
  SELECT * INTO dep FROM public.auction_deposits
    WHERE user_id=o.buyer_id AND lot_id=o.lot_id AND purpose='bid_hold'
      AND status IN ('authorized','charged')
    ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    UPDATE public.auction_deposits SET status='forfeited', purpose='default_fee',
      captured_at=now(), updated_at=now(), order_id=_order_id
      WHERE id=dep.id;
  END IF;

  -- Strike counter
  UPDATE public.bidder_verifications
    SET unpaid_auction_count = unpaid_auction_count + 1,
        failed_payment_count = failed_payment_count + 1,
        updated_at = now()
    WHERE user_id = o.buyer_id
  RETURNING failed_payment_count INTO new_failed;

  IF COALESCE(new_failed,0) >= 2 THEN
    UPDATE public.bidder_verifications
      SET status='restricted', restricted_at=now(),
          restricted_reason='Auto-restricted: 2+ unpaid winning bids',
          updated_at=now()
      WHERE user_id = o.buyer_id;
    INSERT INTO public.bidder_audit_log (user_id, actor_id, action, reason, metadata)
    VALUES (o.buyer_id, NULL, 'auto_restricted', 'Two unpaid auctions',
            jsonb_build_object('order_id', _order_id));
  END IF;

  PERFORM public.notify_admins('admin_default', 'Winner defaulted',
    'A winning bidder did not pay within the deadline. Choose to offer the lot to the runner-up or relist.',
    '/app/admin/bidders', _order_id, o.lot_id, NULL, 'high');

  RETURN 'defaulted';
END $$;

-- 14. Cron-target: sweep all overdue pending-payment orders
CREATE OR REPLACE FUNCTION public.sweep_defaulted_winners()
RETURNS TABLE(order_id uuid, result text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec record; deadline int;
BEGIN
  SELECT winner_payment_deadline_hours INTO deadline FROM public.auction_deposit_settings WHERE singleton=true;
  deadline := COALESCE(deadline, 24);
  FOR rec IN
    SELECT o.id FROM public.orders o
    JOIN public.lots l ON l.id = o.lot_id
    WHERE o.status = 'pending_payment'
      AND l.pricing_type='auction'
      AND o.created_at < now() - (deadline || ' hours')::interval
  LOOP
    order_id := rec.id;
    result := public.handle_defaulted_winner(rec.id);
    RETURN NEXT;
  END LOOP;
END $$;

-- 15. Permissions
GRANT EXECUTE ON FUNCTION public.deposit_tier_band(numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bidder_mark_payment_method_added(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_remove_bid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_deposit_outcome(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.offer_to_next_bidder(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relist_auction(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_defaulted_winner(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_defaulted_winners() TO service_role;

-- 16. Admin can view all bidder verifications (already has SELECT via is_admin in existing policy).
-- Ensure admin SELECT on auction_deposits.
DROP POLICY IF EXISTS dep_admin_select ON public.auction_deposits;
CREATE POLICY dep_admin_select ON public.auction_deposits
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
