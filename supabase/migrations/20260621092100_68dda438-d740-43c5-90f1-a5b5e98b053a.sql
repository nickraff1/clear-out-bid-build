
ALTER VIEW public.admin_stuck_orders SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.notify_user(uuid,text,text,text,text,uuid,uuid,uuid,uuid,boolean,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_admins(text,text,text,text,uuid,uuid,uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_org(uuid,text,text,text,text,uuid,uuid,uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_order(uuid,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_payout_status(uuid,text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_report(uuid,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_org_verified(uuid,boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_org_founding(uuid,boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_org_disabled(uuid,boolean) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_cancel_order(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_payout_status(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_org_verified(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_org_founding(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_org_disabled(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
