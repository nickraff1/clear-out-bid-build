-- Paid orders need order-scoped conversations so admin diagnostics can verify
-- every paid transaction has a buyer/seller chat and order-confirmed message.

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_buyer_id_seller_org_id_lot_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_order_id_unique
  ON public.conversations(order_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_open_listing_unique
  ON public.conversations(buyer_id, seller_org_id, lot_id)
  WHERE order_id IS NULL;

CREATE OR REPLACE FUNCTION public.ensure_conversation(
  _buyer_id uuid,
  _seller_org_id uuid,
  _lot_id uuid DEFAULT NULL,
  _order_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_conversation_id uuid;
  should_seed_order_message boolean;
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF auth.role() <> 'service_role' AND NOT (
    auth.uid() = _buyer_id
    OR public.is_org_member(auth.uid(), _seller_org_id)
    OR public.is_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Conversation participants only' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      COALESCE(_order_id::text, _buyer_id::text || ':' || _seller_org_id::text || ':' || COALESCE(_lot_id::text, 'no-lot')),
      0
    )
  );

  IF _order_id IS NOT NULL THEN
    SELECT id INTO resolved_conversation_id
    FROM public.conversations
    WHERE order_id = _order_id
    LIMIT 1;
  ELSE
    SELECT id INTO resolved_conversation_id
    FROM public.conversations
    WHERE buyer_id = _buyer_id
      AND seller_org_id = _seller_org_id
      AND lot_id IS NOT DISTINCT FROM _lot_id
      AND order_id IS NULL
    LIMIT 1;
  END IF;

  IF resolved_conversation_id IS NULL THEN
    INSERT INTO public.conversations (buyer_id, seller_org_id, lot_id, order_id)
    VALUES (_buyer_id, _seller_org_id, _lot_id, _order_id)
    ON CONFLICT (order_id) DO UPDATE SET
      buyer_id = EXCLUDED.buyer_id,
      seller_org_id = EXCLUDED.seller_org_id,
      lot_id = EXCLUDED.lot_id,
      last_message_at = GREATEST(public.conversations.last_message_at, now())
    RETURNING id INTO resolved_conversation_id;
  END IF;

  IF _order_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = _order_id
        AND o.status IN ('paid', 'ready_for_pickup', 'collected')
    )
    INTO should_seed_order_message;

    IF should_seed_order_message
      AND NOT EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE m.conversation_id = resolved_conversation_id
          AND m.is_system = true
          AND m.body = 'Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed.'
      )
    THEN
      INSERT INTO public.messages (conversation_id, sender_id, is_system, body)
      VALUES (
        resolved_conversation_id,
        _buyer_id,
        true,
        'Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed.'
      );
    END IF;
  END IF;

  RETURN resolved_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_conversation(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_conversation(uuid, uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id) OR EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = _conv_id
      AND (c.buyer_id = _user_id OR public.is_org_member(_user_id, c.seller_org_id))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;

CREATE OR REPLACE VIEW public.admin_messaging_integrity AS
SELECT
  c.id AS conversation_id,
  c.buyer_id,
  c.seller_org_id,
  c.lot_id,
  c.order_id,
  c.created_at,
  c.last_message_at,
  EXISTS(SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id) AS has_messages,
  EXISTS(
    SELECT 1
    FROM public.messages m
    WHERE m.conversation_id = c.id
      AND m.is_system = true
      AND m.body = 'Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed.'
  ) AS has_order_confirmed_message,
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = c.buyer_id) AS has_buyer_profile,
  EXISTS(SELECT 1 FROM public.organizations o WHERE o.id = c.seller_org_id) AS has_seller_org,
  (c.lot_id IS NULL OR EXISTS(SELECT 1 FROM public.lots l WHERE l.id = c.lot_id)) AS has_listing_context,
  (c.order_id IS NULL OR EXISTS(SELECT 1 FROM public.orders o WHERE o.id = c.order_id)) AS has_order_context,
  CASE
    WHEN c.order_id IS NOT NULL
      AND EXISTS(
        SELECT 1
        FROM public.orders o
        WHERE o.id = c.order_id
          AND o.status IN ('paid', 'ready_for_pickup', 'collected')
      )
      AND NOT EXISTS(
        SELECT 1
        FROM public.messages m
        WHERE m.conversation_id = c.id
          AND m.is_system = true
          AND m.body = 'Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed.'
      ) THEN 'paid_order_missing_system_message'
    WHEN NOT EXISTS(SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id) THEN 'conversation_no_messages'
    WHEN NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = c.buyer_id) THEN 'missing_buyer_profile'
    WHEN NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id = c.seller_org_id) THEN 'missing_seller_org'
    WHEN c.lot_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.lots l WHERE l.id = c.lot_id) THEN 'missing_listing'
    WHEN c.order_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.orders o WHERE o.id = c.order_id) THEN 'missing_order'
    ELSE NULL
  END AS issue
FROM public.conversations c
WHERE public.is_admin(auth.uid());

ALTER VIEW public.admin_messaging_integrity SET (security_invoker = true);
GRANT SELECT ON public.admin_messaging_integrity TO authenticated;

WITH missing_paid_order_conversations AS (
  SELECT
    o.id AS order_id,
    o.buyer_id,
    o.lot_id,
    e.org_id AS seller_org_id
  FROM public.orders o
  JOIN public.lots l ON l.id = o.lot_id
  JOIN public.clearance_events e ON e.id = l.event_id
  WHERE o.status IN ('paid', 'ready_for_pickup', 'collected')
    AND e.org_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.order_id = o.id
    )
)
INSERT INTO public.conversations (buyer_id, seller_org_id, lot_id, order_id, last_message_at)
SELECT buyer_id, seller_org_id, lot_id, order_id, now()
FROM missing_paid_order_conversations
ON CONFLICT (order_id) DO UPDATE SET
  buyer_id = EXCLUDED.buyer_id,
  seller_org_id = EXCLUDED.seller_org_id,
  lot_id = EXCLUDED.lot_id;

INSERT INTO public.messages (conversation_id, sender_id, is_system, body)
SELECT
  c.id,
  c.buyer_id,
  true,
  'Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed.'
FROM public.conversations c
JOIN public.orders o ON o.id = c.order_id
WHERE o.status IN ('paid', 'ready_for_pickup', 'collected')
  AND NOT EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.conversation_id = c.id
      AND m.is_system = true
      AND m.body = 'Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed.'
  );