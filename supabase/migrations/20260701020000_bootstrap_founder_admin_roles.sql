-- Controlled founder/admin QA bootstrap.
-- This is intentionally narrow: it only grants admin to explicit founder/QA
-- emails that already have profiles, and it is idempotent.

insert into public.user_roles (user_id, role)
select p.id, 'admin'::public.app_role
from public.profiles p
where lower(p.email) in (
  lower('nickraffmgmt@gmail.com'),
  lower('anthony.younes24@gmail.com')
)
on conflict (user_id, role) do nothing;

insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, details)
select
  p.id,
  'founder_admin_migration_bootstrap',
  'user_roles',
  p.id,
  jsonb_build_object(
    'email', p.email,
    'migration', '20260701020000_bootstrap_founder_admin_roles',
    'note', 'Controlled launch QA bootstrap for founder/admin access.'
  )
from public.profiles p
where lower(p.email) in (
  lower('nickraffmgmt@gmail.com'),
  lower('anthony.younes24@gmail.com')
);
