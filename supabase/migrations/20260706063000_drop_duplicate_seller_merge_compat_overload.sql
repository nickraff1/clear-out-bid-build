-- The temporary compatibility overload makes PostgREST unable to choose between
-- duplicate named-argument RPC candidates. Keep only the canonical guarded RPC:
-- admin_merge_duplicate_seller_org(_target_org_id uuid, _source_org_id uuid, _admin_note text).

DROP FUNCTION IF EXISTS public.admin_merge_duplicate_seller_org(text, uuid, uuid);

REVOKE EXECUTE ON FUNCTION public.admin_merge_duplicate_seller_org(uuid, uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_merge_duplicate_seller_org(uuid, uuid, text) TO authenticated;
