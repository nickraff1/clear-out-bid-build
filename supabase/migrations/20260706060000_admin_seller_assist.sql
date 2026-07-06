-- Admin Seller Assist: server-authorised cross-organisation operations with audit logging.

CREATE TABLE IF NOT EXISTS public.admin_seller_assist_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_seller_assist_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view seller assist audit logs" ON public.admin_seller_assist_audit_logs;
CREATE POLICY "Admins can view seller assist audit logs"
  ON public.admin_seller_assist_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_admin_seller_assist_logs_org_created
  ON public.admin_seller_assist_audit_logs(seller_org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_seller_assist_logs_admin_created
  ON public.admin_seller_assist_audit_logs(admin_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_log_seller_assist(
  _seller_org_id uuid,
  _action text,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _target_user_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _seller_org_id) THEN
    RAISE EXCEPTION 'Seller organisation not found';
  END IF;

  INSERT INTO public.admin_seller_assist_audit_logs (
    admin_user_id, seller_org_id, target_user_id, action, entity_type, entity_id, metadata
  ) VALUES (
    auth.uid(), _seller_org_id, _target_user_id, _action, _entity_type, _entity_id, COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_assisted_org(
  _seller_org_id uuid,
  _name text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _website text DEFAULT NULL,
  _bio text DEFAULT NULL,
  _admin_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(o) INTO v_before FROM public.organizations o WHERE o.id = _seller_org_id;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Seller organisation not found';
  END IF;

  UPDATE public.organizations
  SET
    name = COALESCE(NULLIF(trim(_name), ''), name),
    email = COALESCE(NULLIF(trim(_email), ''), email),
    phone = COALESCE(NULLIF(trim(_phone), ''), phone),
    website = COALESCE(NULLIF(trim(_website), ''), website),
    bio = COALESCE(NULLIF(trim(_bio), ''), bio),
    updated_at = now()
  WHERE id = _seller_org_id;

  PERFORM public.admin_log_seller_assist(
    _seller_org_id,
    'update_seller_org',
    'organization',
    _seller_org_id,
    jsonb_build_object('note', _admin_note, 'before', v_before)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_assisted_listing(
  _seller_org_id uuid,
  _title text,
  _description text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _quantity integer DEFAULT 1,
  _unit text DEFAULT 'each',
  _condition public.lot_condition DEFAULT 'unused',
  _pricing_type public.pricing_type DEFAULT 'fixed',
  _fixed_price numeric DEFAULT NULL,
  _start_price numeric DEFAULT NULL,
  _reserve_price numeric DEFAULT NULL,
  _auction_end timestamptz DEFAULT NULL,
  _publish boolean DEFAULT false,
  _admin_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_lot_id uuid;
  v_org public.organizations%ROWTYPE;
  v_pickup_start timestamptz := now();
  v_pickup_end timestamptz := now() + interval '90 days';
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_org FROM public.organizations WHERE id = _seller_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seller organisation not found';
  END IF;

  IF NULLIF(trim(_title), '') IS NULL THEN
    RAISE EXCEPTION 'Listing title is required';
  END IF;
  IF _quantity IS NULL OR _quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;
  IF _pricing_type = 'fixed' AND (_fixed_price IS NULL OR _fixed_price <= 0) THEN
    RAISE EXCEPTION 'Fixed price must be greater than 0';
  END IF;
  IF _pricing_type = 'auction' THEN
    IF _start_price IS NULL OR _start_price <= 0 THEN
      RAISE EXCEPTION 'Auction start price must be greater than 0';
    END IF;
    IF _auction_end IS NULL OR _auction_end <= now() THEN
      RAISE EXCEPTION 'Auction end must be in the future';
    END IF;
    v_pickup_start := GREATEST(now(), _auction_end);
    v_pickup_end := v_pickup_start + interval '30 days';
  END IF;

  SELECT id INTO v_event_id
  FROM public.clearance_events
  WHERE org_id = _seller_org_id
    AND title = 'Admin assisted listings'
    AND status IN ('draft', 'active')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_event_id IS NULL THEN
    INSERT INTO public.clearance_events (
      org_id, created_by, title, description, site_address, suburb, state, postcode,
      pickup_start, pickup_end, status
    ) VALUES (
      _seller_org_id,
      auth.uid(),
      'Admin assisted listings',
      'Listings prepared by Offcutt admin assist.',
      COALESCE(NULLIF(v_org.address, ''), 'TBC'),
      COALESCE(NULLIF(v_org.suburb, ''), 'Sydney'),
      COALESCE(NULLIF(v_org.state, ''), 'NSW'),
      COALESCE(v_org.postcode, ''),
      v_pickup_start,
      v_pickup_end,
      'active'
    )
    RETURNING id INTO v_event_id;
  ELSE
    UPDATE public.clearance_events
    SET pickup_start = LEAST(pickup_start, v_pickup_start),
        pickup_end = GREATEST(pickup_end, v_pickup_end),
        status = 'active',
        updated_at = now()
    WHERE id = v_event_id;
  END IF;

  INSERT INTO public.lots (
    event_id, category_id, title, description, quantity, unit, condition,
    pricing_type, fixed_price, start_price, reserve_price, current_bid, bid_count,
    auction_end, status, buy_now_price, min_bid_increment, reserve_met, is_featured,
    prohibited_materials_confirmed, view_count
  ) VALUES (
    v_event_id, _category_id, trim(_title), NULLIF(trim(COALESCE(_description, '')), ''),
    _quantity, COALESCE(NULLIF(trim(_unit), ''), 'each'), _condition,
    _pricing_type,
    CASE WHEN _pricing_type = 'fixed' THEN _fixed_price ELSE NULL END,
    CASE WHEN _pricing_type = 'auction' THEN _start_price ELSE NULL END,
    CASE WHEN _pricing_type = 'auction' THEN _reserve_price ELSE NULL END,
    NULL, 0,
    CASE WHEN _pricing_type = 'auction' THEN _auction_end ELSE NULL END,
    CASE WHEN _publish THEN 'active'::public.lot_status ELSE 'draft'::public.lot_status END,
    CASE WHEN _pricing_type = 'fixed' THEN _fixed_price ELSE NULL END,
    5, false, false,
    true, 0
  )
  RETURNING id INTO v_lot_id;

  PERFORM public.admin_log_seller_assist(
    _seller_org_id,
    CASE WHEN _pricing_type = 'auction' THEN 'create_auction_listing' ELSE 'create_listing' END,
    'lot',
    v_lot_id,
    jsonb_build_object('published', _publish, 'note', _admin_note, 'pricing_type', _pricing_type)
  );

  RETURN v_lot_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_assisted_listing(
  _seller_org_id uuid,
  _lot_id uuid,
  _title text DEFAULT NULL,
  _description text DEFAULT NULL,
  _quantity integer DEFAULT NULL,
  _unit text DEFAULT NULL,
  _fixed_price numeric DEFAULT NULL,
  _start_price numeric DEFAULT NULL,
  _reserve_price numeric DEFAULT NULL,
  _auction_end timestamptz DEFAULT NULL,
  _status public.lot_status DEFAULT NULL,
  _admin_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot public.lots%ROWTYPE;
  v_org_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_lot
  FROM public.lots
  WHERE id = _lot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  SELECT ce.org_id INTO v_org_id
  FROM public.clearance_events ce
  WHERE ce.id = v_lot.event_id;

  IF v_org_id <> _seller_org_id THEN
    RAISE EXCEPTION 'Listing does not belong to selected seller organisation';
  END IF;

  IF _status IS NOT NULL AND _status::text NOT IN ('draft', 'active', 'cancelled', 'unsold') THEN
    RAISE EXCEPTION 'Unsupported assisted status';
  END IF;
  IF v_lot.status::text IN ('sold', 'reserved') AND _status IS DISTINCT FROM v_lot.status THEN
    RAISE EXCEPTION 'Sold or reserved listings cannot be status-edited from admin assist';
  END IF;
  IF v_lot.pricing_type = 'auction' AND v_lot.bid_count > 0 THEN
    IF _start_price IS NOT NULL OR _reserve_price IS NOT NULL OR _auction_end IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot edit auction price/end after bids exist';
    END IF;
  END IF;

  UPDATE public.lots
  SET
    title = COALESCE(NULLIF(trim(_title), ''), title),
    description = COALESCE(NULLIF(trim(_description), ''), description),
    quantity = COALESCE(_quantity, quantity),
    unit = COALESCE(NULLIF(trim(_unit), ''), unit),
    fixed_price = CASE WHEN pricing_type = 'fixed' THEN COALESCE(_fixed_price, fixed_price) ELSE fixed_price END,
    buy_now_price = CASE WHEN pricing_type = 'fixed' THEN COALESCE(_fixed_price, buy_now_price) ELSE buy_now_price END,
    start_price = CASE WHEN pricing_type = 'auction' THEN COALESCE(_start_price, start_price) ELSE start_price END,
    reserve_price = CASE WHEN pricing_type = 'auction' THEN COALESCE(_reserve_price, reserve_price) ELSE reserve_price END,
    auction_end = CASE WHEN pricing_type = 'auction' THEN COALESCE(_auction_end, auction_end) ELSE auction_end END,
    status = COALESCE(_status, status),
    updated_at = now()
  WHERE id = _lot_id;

  PERFORM public.admin_log_seller_assist(
    _seller_org_id,
    'edit_listing',
    'lot',
    _lot_id,
    jsonb_build_object('status', _status, 'note', _admin_note)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_log_seller_assist(uuid, text, text, uuid, jsonb, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_assisted_org(uuid, text, text, text, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_create_assisted_listing(uuid, text, text, uuid, integer, text, public.lot_condition, public.pricing_type, numeric, numeric, numeric, timestamptz, boolean, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_assisted_listing(uuid, uuid, text, text, integer, text, numeric, numeric, numeric, timestamptz, public.lot_status, text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_log_seller_assist(uuid, text, text, uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_assisted_org(uuid, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_assisted_listing(uuid, text, text, uuid, integer, text, public.lot_condition, public.pricing_type, numeric, numeric, numeric, timestamptz, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_assisted_listing(uuid, uuid, text, text, integer, text, numeric, numeric, numeric, timestamptz, public.lot_status, text) TO authenticated;
