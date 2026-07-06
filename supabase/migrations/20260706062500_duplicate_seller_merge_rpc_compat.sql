-- Compatibility wrapper for PostgREST/Lovable schema-cache variants that
-- resolve RPC parameters alphabetically.

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
