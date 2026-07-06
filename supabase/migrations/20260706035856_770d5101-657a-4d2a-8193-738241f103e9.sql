
CREATE OR REPLACE FUNCTION public.relist_auction_lot(
  p_lot_id uuid,
  p_auction_end timestamptz,
  p_start_price numeric DEFAULT NULL,
  p_reserve_price numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot public.lots%ROWTYPE;
  v_org_id uuid;
  v_new_id uuid;
BEGIN
  SELECT * INTO v_lot FROM public.lots WHERE id = p_lot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lot not found'; END IF;
  IF v_lot.pricing_type <> 'auction' THEN RAISE EXCEPTION 'Only auction lots can be relisted'; END IF;
  IF v_lot.status NOT IN ('unsold','cancelled') THEN RAISE EXCEPTION 'Only unsold or cancelled lots can be relisted'; END IF;

  SELECT ce.org_id INTO v_org_id FROM public.clearance_events ce WHERE ce.id = v_lot.event_id;
  IF NOT public.is_org_member(auth.uid(), v_org_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF p_auction_end <= now() THEN RAISE EXCEPTION 'Auction end must be in the future'; END IF;

  INSERT INTO public.lots (
    event_id, category_id, title, description, quantity, unit, condition,
    pricing_type, fixed_price, start_price, reserve_price, current_bid, bid_count,
    auction_end, status, buy_now_price, min_bid_increment, reserve_met, is_featured,
    retail_estimate, prohibited_materials_confirmed, view_count,
    winning_bidder_id, reserved_order_id, reserved_until
  ) VALUES (
    v_lot.event_id, v_lot.category_id, v_lot.title, v_lot.description, v_lot.quantity, v_lot.unit, v_lot.condition,
    v_lot.pricing_type, v_lot.fixed_price,
    COALESCE(p_start_price, v_lot.start_price),
    COALESCE(p_reserve_price, v_lot.reserve_price),
    NULL, 0,
    p_auction_end, 'active', v_lot.buy_now_price, v_lot.min_bid_increment, false, false,
    v_lot.retail_estimate, v_lot.prohibited_materials_confirmed, 0,
    NULL, NULL, NULL
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.lot_media (lot_id, url, type, is_primary, sort_order)
  SELECT v_new_id, url, type, is_primary, sort_order
  FROM public.lot_media WHERE lot_id = p_lot_id;

  INSERT INTO public.lot_compliance_tags (lot_id, tag_id)
  SELECT v_new_id, tag_id FROM public.lot_compliance_tags WHERE lot_id = p_lot_id;

  RETURN v_new_id;
END;
$$;
