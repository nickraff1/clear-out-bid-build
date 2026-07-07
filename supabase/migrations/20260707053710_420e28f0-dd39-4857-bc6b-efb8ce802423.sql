CREATE OR REPLACE FUNCTION public.update_order_pickup(
  _order_id uuid,
  _action text,
  _proposed_pickup_at timestamptz DEFAULT NULL,
  _pickup_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  ord public.orders%ROWTYPE;
  seller_org uuid;
  actor_is_buyer boolean := false;
  actor_is_seller boolean := false;
  actor_is_admin boolean := false;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT o.* INTO ord FROM public.orders o WHERE o.id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT ce.org_id INTO seller_org FROM public.clearance_events ce WHERE ce.id = ord.event_id;

  actor_is_buyer := ord.buyer_id = actor
    OR (ord.buyer_org_id IS NOT NULL AND public.is_org_member(actor, ord.buyer_org_id));
  actor_is_seller := seller_org IS NOT NULL AND public.is_org_member(actor, seller_org);
  actor_is_admin := public.is_admin(actor);

  IF NOT (actor_is_buyer OR actor_is_seller OR actor_is_admin) THEN
    RAISE EXCEPTION 'Not authorised for this order' USING ERRCODE = '42501';
  END IF;

  IF ord.status NOT IN ('paid', 'ready_for_pickup', 'collected') THEN
    RAISE EXCEPTION 'Pickup can only be managed after payment is confirmed';
  END IF;

  IF _action = 'propose' THEN
    IF _proposed_pickup_at IS NULL THEN
      RAISE EXCEPTION 'Pickup time is required';
    END IF;
    IF _proposed_pickup_at < now() THEN
      RAISE EXCEPTION 'Pickup time must be in the future';
    END IF;
    UPDATE public.orders
    SET proposed_pickup_at = _proposed_pickup_at,
        proposed_pickup_by = actor,
        agreed_pickup_at = NULL,
        pickup_status = 'pickup_proposed'
    WHERE id = _order_id
    RETURNING * INTO ord;

  ELSIF _action = 'accept' THEN
    IF ord.proposed_pickup_at IS NULL THEN
      RAISE EXCEPTION 'No pickup time has been proposed';
    END IF;
    IF ord.proposed_pickup_by = actor AND NOT actor_is_admin THEN
      RAISE EXCEPTION 'The other party must accept the proposed time';
    END IF;
    UPDATE public.orders
    SET agreed_pickup_at = ord.proposed_pickup_at,
        pickup_status = 'pickup_confirmed'
    WHERE id = _order_id
    RETURNING * INTO ord;

  ELSIF _action = 'clear' THEN
    UPDATE public.orders
    SET proposed_pickup_at = NULL,
        proposed_pickup_by = NULL,
        pickup_status = 'awaiting_arrangement'
    WHERE id = _order_id
    RETURNING * INTO ord;

  ELSIF _action = 'mark_ready' THEN
    IF NOT (actor_is_seller OR actor_is_admin) THEN
      RAISE EXCEPTION 'Only the seller can mark this order ready for pickup' USING ERRCODE = '42501';
    END IF;
    UPDATE public.orders
    SET status = 'ready_for_pickup',
        pickup_status = 'ready_for_pickup'
    WHERE id = _order_id
    RETURNING * INTO ord;

  ELSIF _action = 'buyer_collected' THEN
    IF NOT (actor_is_buyer OR actor_is_admin) THEN
      RAISE EXCEPTION 'Only the buyer can mark this order collected' USING ERRCODE = '42501';
    END IF;
    UPDATE public.orders
    SET buyer_collected_at = now(),
        pickup_status = 'collected_pending_seller_confirmation'
    WHERE id = _order_id
    RETURNING * INTO ord;

  ELSIF _action = 'seller_confirm' THEN
    IF NOT (actor_is_seller OR actor_is_admin) THEN
      RAISE EXCEPTION 'Only the seller can confirm pickup' USING ERRCODE = '42501';
    END IF;
    IF upper(trim(coalesce(_pickup_code, ''))) <> upper(trim(coalesce(ord.pickup_code, ''))) THEN
      RAISE EXCEPTION 'Pickup code does not match';
    END IF;
    UPDATE public.orders
    SET status = 'collected',
        pickup_status = 'completed',
        seller_confirmed_at = now()
    WHERE id = _order_id
    RETURNING * INTO ord;

  ELSE
    RAISE EXCEPTION 'Unsupported pickup action: %', _action;
  END IF;

  RETURN jsonb_build_object(
    'id', ord.id,
    'status', ord.status,
    'pickup_status', ord.pickup_status,
    'proposed_pickup_at', ord.proposed_pickup_at,
    'agreed_pickup_at', ord.agreed_pickup_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_pickup(uuid, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_order_pickup(uuid, text, timestamptz, text) TO authenticated;

NOTIFY pgrst, 'reload schema';