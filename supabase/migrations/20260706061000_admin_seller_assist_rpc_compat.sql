-- Keep admin seller assist audit logging compatible with PostgREST schema cache
-- lookups that omit optional RPC arguments.

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = _seller_org_id
      AND org_type IN ('seller', 'fabricator')
  ) THEN
    RAISE EXCEPTION 'Seller organisation not found';
  END IF;

  INSERT INTO public.admin_seller_assist_audit_logs (
    admin_user_id,
    seller_org_id,
    target_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    auth.uid(),
    _seller_org_id,
    _target_user_id,
    _action,
    _entity_type,
    _entity_id,
    COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_log_seller_assist(
  _action text,
  _entity_id uuid,
  _entity_type text,
  _metadata jsonb,
  _seller_org_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_log_seller_assist(
    _seller_org_id,
    _action,
    _entity_type,
    _entity_id,
    _metadata,
    NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_log_seller_assist(uuid, text, text, uuid, jsonb, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_log_seller_assist(text, uuid, text, jsonb, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_log_seller_assist(uuid, text, text, uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_log_seller_assist(text, uuid, text, jsonb, uuid) TO authenticated;
