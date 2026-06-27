-- Final launch readiness: admin bootstrap/control helpers and messaging diagnostics.

-- Existing admins may grant or revoke roles by email. First-admin bootstrap still
-- requires service-role SQL and is documented in docs/admin-access.md.
CREATE OR REPLACE FUNCTION public.admin_grant_user_role(_email text, _role public.app_role)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO target_user_id
  FROM public.profiles
  WHERE lower(email) = lower(_email)
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No profile found for email %', _email USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.admin_audit_logs (admin_id, action, entity_type, entity_id, new_data)
  VALUES (
    auth.uid(),
    'admin_grant_user_role',
    'user',
    target_user_id,
    jsonb_build_object('email', _email, 'role', _role)
  );

  RETURN target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_user_role(_email text, _role public.app_role)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO target_user_id
  FROM public.profiles
  WHERE lower(email) = lower(_email)
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No profile found for email %', _email USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = target_user_id AND role = _role;

  INSERT INTO public.admin_audit_logs (admin_id, action, entity_type, entity_id, new_data)
  VALUES (
    auth.uid(),
    'admin_revoke_user_role',
    'user',
    target_user_id,
    jsonb_build_object('email', _email, 'role', _role)
  );

  RETURN target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_user_role(text, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_role(text, public.app_role) TO authenticated;

-- One canonical way for buyer/seller/admin flows to resolve a conversation.
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    auth.uid() = _buyer_id
    OR public.is_org_member(auth.uid(), _seller_org_id)
    OR public.is_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Conversation participants only' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      _buyer_id::text || ':' || _seller_org_id::text || ':' || COALESCE(_lot_id::text, 'no-lot'),
      0
    )
  );

  SELECT id INTO resolved_conversation_id
  FROM public.conversations
  WHERE buyer_id = _buyer_id
    AND seller_org_id = _seller_org_id
    AND lot_id IS NOT DISTINCT FROM _lot_id
  LIMIT 1;

  IF resolved_conversation_id IS NULL THEN
    INSERT INTO public.conversations (buyer_id, seller_org_id, lot_id, order_id)
    VALUES (_buyer_id, _seller_org_id, _lot_id, _order_id)
    RETURNING id INTO resolved_conversation_id;
  ELSIF _order_id IS NOT NULL THEN
    UPDATE public.conversations
    SET order_id = COALESCE(order_id, _order_id)
    WHERE id = resolved_conversation_id;
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

-- Admins must be able to diagnose buyer/seller messaging failures.
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
  )
$$;

DROP POLICY IF EXISTS "Participants view conversations" ON public.conversations;
CREATE POLICY "Participants view conversations"
  ON public.conversations
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid()
    OR public.is_org_member(auth.uid(), seller_org_id)
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Participants update conversation" ON public.conversations;
CREATE POLICY "Participants update conversation"
  ON public.conversations
  FOR UPDATE TO authenticated
  USING (
    buyer_id = auth.uid()
    OR public.is_org_member(auth.uid(), seller_org_id)
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    buyer_id = auth.uid()
    OR public.is_org_member(auth.uid(), seller_org_id)
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Participants create conversation" ON public.conversations;
CREATE POLICY "Participants create conversation"
  ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    OR public.is_org_member(auth.uid(), seller_org_id)
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Buyer creates conversation" ON public.conversations;

DROP POLICY IF EXISTS "Participants view messages" ON public.messages;
CREATE POLICY "Participants view messages"
  ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Participants send messages" ON public.messages;
CREATE POLICY "Participants send messages"
  ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(auth.uid(), conversation_id)
  );

DROP POLICY IF EXISTS "Recipient marks read" ON public.messages;
CREATE POLICY "Recipient marks read"
  ON public.messages
  FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(auth.uid(), conversation_id))
  WITH CHECK (public.is_conversation_participant(auth.uid(), conversation_id));

-- Admin messaging diagnostics used by launch checklist/admin docs.
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
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = c.buyer_id) AS has_buyer_profile,
  EXISTS(SELECT 1 FROM public.organizations o WHERE o.id = c.seller_org_id) AS has_seller_org,
  (c.lot_id IS NULL OR EXISTS(SELECT 1 FROM public.lots l WHERE l.id = c.lot_id)) AS has_listing_context,
  (c.order_id IS NULL OR EXISTS(SELECT 1 FROM public.orders o WHERE o.id = c.order_id)) AS has_order_context,
  CASE
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
