# Admin Access

## Current admin model

Admin access is represented by `public.user_roles.role = 'admin'`.

Code paths:

- Frontend auth context reads `user_roles` in `src/contexts/AuthContext.tsx`.
- `isAdmin` is true when the signed-in user has `admin` in `user_roles`.
- Admin routes are wrapped in `RoleGuard allowedRoles={['admin']}`.
- Server-side checks use `public.is_admin(auth.uid())`.
- Admin RPCs raise `Admin only` when `public.is_admin(auth.uid())` is false.

There is no `admin_users` table and no hardcoded admin email in the app.

## Founder bootstrap

The first admin must be granted by a trusted database operator using the Supabase SQL editor or service-role context. Do not run this from the frontend.

Replace the email with the founder account:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from public.profiles
where lower(email) = lower('nickraffmgmt@gmail.com')
on conflict (user_id, role) do nothing;
```

For the Anthony test account:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from public.profiles
where lower(email) = lower('anthony.younes24@gmail.com')
on conflict (user_id, role) do nothing;
```

## Grant admin after bootstrap

After one admin exists, use the restricted RPC:

```sql
select public.admin_grant_user_role('owner@example.com', 'admin');
```

This RPC:

- requires the caller to already be admin
- looks up the user by profile email
- inserts the role idempotently
- writes an admin audit log entry

## Revoke admin

After one admin exists, use:

```sql
select public.admin_revoke_user_role('owner@example.com', 'admin');
```

Do not revoke the last working admin without first granting another account.

## Verify access

1. Sign in.
2. Open `/app/admin`.
3. Open `/app/admin/launch`.
4. Confirm the launch checklist says current user admin access passes.
5. Confirm admin RPC availability passes.

If blocked, admin-only routes show a clear "You do not have admin access" state.

## Admin routes

- `/app/admin`
- `/app/admin/overview`
- `/app/admin/analytics`
- `/app/admin/launch`
- `/app/admin/launch-checklist`
- `/app/admin/orders`
- `/app/admin/payments`
- `/app/admin/payouts`
- `/app/admin/reports`
- `/app/admin/listings`
- `/app/admin/users`
- `/app/admin/sellers`
- `/app/admin/bidders`
- `/app/admin/auctions`
- `/app/admin/fees`
- `/app/admin/notifications`
- `/app/admin/messages`

## Supported admin actions

- view users and roles
- view listings
- view orders
- regenerate pickup code
- force-complete order with note
- cancel order with note
- add internal order note
- view and resolve reports
- verify seller organisations
- mark founding sellers
- suspend/reactivate seller organisations
- view bidder risk state
- restrict/ban/trust bidders
- remove suspicious bids using admin RPC
- view payments/manual payouts
- mark manual payout status with notes
- close expired auctions
- inspect messaging integrity via launch checklist
- inspect marketplace conversations via `/app/admin/messages`

## Known limitations

- First admin bootstrap still requires direct database/service-role access.
- Admin role assignment UI is not yet built.
- Admin messaging diagnostics can identify broken conversations, but a one-click "repair conversation" admin action is not yet built.
- Legal review is still required before broad public launch.
