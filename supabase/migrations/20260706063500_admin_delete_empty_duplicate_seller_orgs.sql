-- Admin-only cleanup for duplicate seller organisations that have no
-- marketplace, Stripe, messaging, import, review, report, badge, or audit data.

CREATE OR REPLACE FUNCTION public.admin_delete_empty_duplicate_seller_orgs(
  _target_org_id uuid,
  _source_org_ids uuid[],
  _admin_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.organizations%ROWTYPE;
  v_source public.organizations%ROWTYPE;
  v_source_id uuid;
  v_deleted uuid[] := '{}';
  v_skipped jsonb := '[]'::jsonb;
  v_reason text;
  v_target_norm text;
  v_source_norm text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
  END IF;

  IF _target_org_id IS NULL OR _source_org_ids IS NULL OR array_length(_source_org_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Target and source organisations are required';
  END IF;

  SELECT * INTO v_target FROM public.organizations WHERE id = _target_org_id;
  IF v_target.id IS NULL OR v_target.org_type NOT IN ('seller', 'fabricator') THEN
    RAISE EXCEPTION 'Target seller organisation not found';
  END IF;

  v_target_norm := lower(regexp_replace(regexp_replace(v_target.name, '\m(pty|ltd|limited|business|account|company|co)\M', '', 'gi'), '[^a-z0-9]+', ' ', 'gi'));

  FOREACH v_source_id IN ARRAY _source_org_ids LOOP
    v_reason := NULL;
    SELECT * INTO v_source FROM public.organizations WHERE id = v_source_id FOR UPDATE;

    IF v_source.id IS NULL THEN
      v_reason := 'source_not_found';
    ELSIF v_source.id = _target_org_id THEN
      v_reason := 'source_is_target';
    ELSIF v_source.org_type NOT IN ('seller', 'fabricator') THEN
      v_reason := 'not_seller_org';
    ELSE
      v_source_norm := lower(regexp_replace(regexp_replace(v_source.name, '\m(pty|ltd|limited|business|account|company|co)\M', '', 'gi'), '[^a-z0-9]+', ' ', 'gi'));
      IF v_source_norm <> v_target_norm THEN
        v_reason := 'name_not_duplicate';
      ELSIF EXISTS (SELECT 1 FROM public.clearance_events WHERE org_id = v_source.id) THEN
        v_reason := 'has_events_or_listings';
      ELSIF EXISTS (SELECT 1 FROM public.bulk_imports WHERE seller_org_id = v_source.id) THEN
        v_reason := 'has_bulk_imports';
      ELSIF EXISTS (SELECT 1 FROM public.conversations WHERE seller_org_id = v_source.id) THEN
        v_reason := 'has_conversations';
      ELSIF EXISTS (SELECT 1 FROM public.seller_stripe_accounts WHERE org_id = v_source.id) THEN
        v_reason := 'has_stripe_account';
      ELSIF EXISTS (SELECT 1 FROM public.seller_badges WHERE org_id = v_source.id) THEN
        v_reason := 'has_badges';
      ELSIF EXISTS (SELECT 1 FROM public.reviews WHERE reviewee_org_id = v_source.id) THEN
        v_reason := 'has_reviews';
      ELSIF EXISTS (SELECT 1 FROM public.admin_seller_assist_audit_logs WHERE seller_org_id = v_source.id) THEN
        v_reason := 'has_admin_audit_logs';
      END IF;
    END IF;

    IF v_reason IS NULL THEN
      DELETE FROM public.org_members WHERE org_id = v_source.id;
      DELETE FROM public.organizations WHERE id = v_source.id;
      v_deleted := array_append(v_deleted, v_source.id);
    ELSE
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'org_id', v_source_id,
        'reason', v_reason
      ));
    END IF;
  END LOOP;

  PERFORM public.admin_log_seller_assist(
    _target_org_id,
    'delete_empty_duplicate_seller_orgs',
    'organization',
    _target_org_id,
    jsonb_build_object(
      'deleted_org_ids', v_deleted,
      'skipped', v_skipped,
      'note', _admin_note
    ),
    NULL
  );

  RETURN jsonb_build_object(
    'deleted_count', COALESCE(array_length(v_deleted, 1), 0),
    'deleted_org_ids', v_deleted,
    'skipped', v_skipped
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_empty_duplicate_seller_orgs(uuid, uuid[], text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_delete_empty_duplicate_seller_orgs(uuid, uuid[], text) TO authenticated;
