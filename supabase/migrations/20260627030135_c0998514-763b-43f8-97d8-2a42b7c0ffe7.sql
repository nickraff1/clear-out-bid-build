CREATE OR REPLACE FUNCTION public.can_user_bid(_user_id uuid, _lot_id uuid)
 RETURNS TABLE(allowed boolean, reason text, required_deposit numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v record;
  lot record;
  current_terms text;
  current_price numeric;
BEGIN
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

  SELECT * INTO v FROM public.bidder_verifications WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'verification_required', 0::numeric; RETURN;
  END IF;
  IF v.status IN ('banned','restricted') THEN
    RETURN QUERY SELECT false, ('account_'||v.status::text), 0::numeric; RETURN;
  END IF;

  SELECT current_terms_version INTO current_terms FROM public.auction_deposit_settings WHERE singleton=true;
  IF v.auction_terms_accepted_at IS NULL OR v.auction_terms_version IS DISTINCT FROM current_terms THEN
    RETURN QUERY SELECT false, 'terms_acceptance_required', 0::numeric; RETURN;
  END IF;

  IF v.stripe_payment_method_id IS NULL THEN
    RETURN QUERY SELECT false, 'payment_method_required', 0::numeric; RETURN;
  END IF;

  IF v.unpaid_auction_count > 0 THEN
    RETURN QUERY SELECT false, 'unpaid_previous_auction', 0::numeric; RETURN;
  END IF;

  current_price := COALESCE(lot.current_bid, lot.start_price, 0);
  RETURN QUERY SELECT true, 'ok', public.required_deposit_for(current_price, _user_id);
END $function$;