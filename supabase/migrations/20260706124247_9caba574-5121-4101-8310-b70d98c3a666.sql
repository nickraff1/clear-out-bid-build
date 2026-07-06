CREATE OR REPLACE VIEW public.admin_duplicate_seller_org_candidates AS
WITH seller_orgs AS (
  SELECT
    o.id,
    o.name,
    o.org_type,
    o.created_at,
    lower(regexp_replace(regexp_replace(o.name, '\m(pty|ltd|limited|business|account|company|co)\M', '', 'gi'), '[^a-z0-9]+', ' ', 'gi')) AS normalized_name,
    COALESCE(jsonb_agg(DISTINCT jsonb_build_object('user_id', om.user_id, 'email', p.email, 'full_name', p.full_name)) FILTER (WHERE om.user_id IS NOT NULL), '[]'::jsonb) AS owners,
    array_remove(array_agg(DISTINCT om.user_id), NULL) AS owner_user_ids,
    COUNT(DISTINCT ce.id) AS event_count,
    COUNT(DISTINCT l.id) AS lot_count,
    COUNT(DISTINCT o2.id) AS order_count,
    COUNT(DISTINCT c.id) AS conversation_count,
    COUNT(DISTINCT ssa.org_id) AS stripe_account_count,
    MAX(ssa.stripe_account_id) AS stripe_account_id
  FROM public.organizations o
  LEFT JOIN public.org_members om ON om.org_id = o.id
  LEFT JOIN public.profiles p ON p.id = om.user_id
  LEFT JOIN public.clearance_events ce ON ce.org_id = o.id
  LEFT JOIN public.lots l ON l.event_id = ce.id
  LEFT JOIN public.orders o2 ON o2.event_id = ce.id
  LEFT JOIN public.conversations c ON c.seller_org_id = o.id
  LEFT JOIN public.seller_stripe_accounts ssa ON ssa.org_id = o.id
  WHERE o.org_type IN ('seller', 'fabricator')
    AND public.is_admin(auth.uid())
  GROUP BY o.id, o.name, o.org_type, o.created_at
),
groups AS (
  SELECT
    COALESCE(array_to_string(owner_user_ids, ','), normalized_name) AS duplicate_key,
    COUNT(*) AS duplicate_count
  FROM seller_orgs
  GROUP BY COALESCE(array_to_string(owner_user_ids, ','), normalized_name)
  HAVING COUNT(*) > 1
)
SELECT so.*
FROM seller_orgs so
JOIN groups g ON g.duplicate_key = COALESCE(array_to_string(so.owner_user_ids, ','), so.normalized_name);

CREATE OR REPLACE FUNCTION public.admin_merge_duplicate_seller_org(
  _target_org_id uuid,
  _source_org_id uuid,
  _admin_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.organizations%ROWTYPE;
  v_source public.organizations%ROWTYPE;
  v_shared_owner boolean;
  v_target_stripe text;
  v_source_stripe text;
  v_conversation_conflicts integer;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  IF _target_org_id IS NULL OR _source_org_id IS NULL OR _target_org_id = _source_org_id THEN
    RAISE EXCEPTION 'Choose two different seller organisations';
  END IF;

  SELECT * INTO v_target FROM public.organizations WHERE id = _target_org_id FOR UPDATE;
  SELECT * INTO v_source FROM public.organizations WHERE id = _source_org_id FOR UPDATE;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Target organisation not found';
  END IF;
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Source organisation not found';
  END IF;
  IF v_target.org_type NOT IN ('seller', 'fabricator') OR v_source.org_type NOT IN ('seller', 'fabricator') THEN
    RAISE EXCEPTION 'Only seller/fabricator organisations can be merged with this tool';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.org_members source_member
    JOIN public.org_members target_member
      ON target_member.user_id = source_member.user_id
    WHERE source_member.org_id = _source_org_id
      AND target_member.org_id = _target_org_id
  ) INTO v_shared_owner;

  IF NOT v_shared_owner THEN
    RAISE EXCEPTION 'Refusing to merge organisations without a shared owner';
  END IF;

  SELECT stripe_account_id INTO v_target_stripe
  FROM public.seller_stripe_accounts
  WHERE org_id = _target_org_id;

  SELECT stripe_account_id INTO v_source_stripe
  FROM public.seller_stripe_accounts
  WHERE org_id = _source_org_id;

  IF v_target_stripe IS NOT NULL AND v_source_stripe IS NOT NULL AND v_target_stripe <> v_source_stripe THEN
    RAISE EXCEPTION 'Both organisations have different Stripe Connect accounts. Resolve Stripe ownership manually first.';
  END IF;

  SELECT COUNT(*) INTO v_conversation_conflicts
  FROM public.conversations source_conversation
  JOIN public.conversations target_conversation
    ON target_conversation.seller_org_id = _target_org_id
   AND (
      (source_conversation.order_id IS NOT NULL AND target_conversation.order_id = source_conversation.order_id)
      OR (
        source_conversation.order_id IS NULL
        AND target_conversation.order_id IS NULL
        AND target_conversation.buyer_id = source_conversation.buyer_id
        AND target_conversation.lot_id IS NOT DISTINCT FROM source_conversation.lot_id
      )
   )
  WHERE source_conversation.seller_org_id = _source_org_id;

  IF v_conversation_conflicts > 0 THEN
    RAISE EXCEPTION 'Conversation conflicts found. Merge conversations manually before merging organisations.';
  END IF;

  INSERT INTO public.org_members (user_id, org_id, is_primary)
  SELECT om.user_id, _target_org_id, om.is_primary
  FROM public.org_members om
  WHERE om.org_id = _source_org_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.org_members existing
      WHERE existing.user_id = om.user_id
        AND existing.org_id = _target_org_id
    );

  UPDATE public.clearance_events SET org_id = _target_org_id, updated_at = now() WHERE org_id = _source_org_id;
  UPDATE public.bulk_imports SET seller_org_id = _target_org_id WHERE seller_org_id = _source_org_id;
  UPDATE public.conversations SET seller_org_id = _target_org_id WHERE seller_org_id = _source_org_id;
  UPDATE public.reviews SET reviewee_org_id = _target_org_id WHERE reviewee_org_id = _source_org_id;
  UPDATE public.admin_seller_assist_audit_logs SET seller_org_id = _target_org_id WHERE seller_org_id = _source_org_id;

  INSERT INTO public.seller_badges (org_id, badge, granted_by, granted_at)
  SELECT _target_org_id, sb.badge, sb.granted_by, sb.granted_at
  FROM public.seller_badges sb
  WHERE sb.org_id = _source_org_id
  ON CONFLICT (org_id, badge) DO NOTHING;
  DELETE FROM public.seller_badges WHERE org_id = _source_org_id;

  IF v_target_stripe IS NULL AND v_source_stripe IS NOT NULL THEN
    UPDATE public.seller_stripe_accounts SET org_id = _target_org_id WHERE org_id = _source_org_id;
  ELSE
    DELETE FROM public.seller_stripe_accounts WHERE org_id = _source_org_id;
  END IF;

  DELETE FROM public.org_members WHERE org_id = _source_org_id;
  DELETE FROM public.organizations WHERE id = _source_org_id;

  PERFORM public.admin_log_seller_assist(
    _target_org_id,
    'merge_duplicate_seller_org',
    'organization',
    _target_org_id,
    jsonb_build_object(
      'source_org_id', _source_org_id,
      'source_name', v_source.name,
      'target_name', v_target.name,
      'note', _admin_note
    ),
    NULL
  );

  v_result := jsonb_build_object(
    'merged', true,
    'source_org_id', _source_org_id,
    'target_org_id', _target_org_id,
    'source_name', v_source.name,
    'target_name', v_target.name
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON public.admin_duplicate_seller_org_candidates FROM anon, public;
GRANT SELECT ON public.admin_duplicate_seller_org_candidates TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_merge_duplicate_seller_org(uuid, uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_merge_duplicate_seller_org(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_merge_duplicate_seller_org(
  _admin_note text,
  _source_org_id uuid,
  _target_org_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_merge_duplicate_seller_org(
    _target_org_id,
    _source_org_id,
    _admin_note
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_merge_duplicate_seller_org(text, uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_merge_duplicate_seller_org(text, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';