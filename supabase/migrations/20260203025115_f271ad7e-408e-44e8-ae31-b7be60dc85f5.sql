-- Fix org_members RLS policies to allow self-registration during onboarding
DROP POLICY IF EXISTS "Org admins can manage members" ON public.org_members;

-- Allow users to add themselves to organizations (for onboarding)
CREATE POLICY "Users can add themselves to orgs" ON public.org_members 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow org members to manage their organization's members
CREATE POLICY "Org members can update members" ON public.org_members 
FOR UPDATE USING (public.is_org_member(auth.uid(), org_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Org members can delete members" ON public.org_members 
FOR DELETE USING (public.is_org_member(auth.uid(), org_id) OR public.is_admin(auth.uid()));

-- Fix user_roles RLS policies to allow self-assignment during onboarding
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Allow users to assign themselves initial roles (for onboarding)
CREATE POLICY "Users can assign themselves roles" ON public.user_roles 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Keep admin-only controls for updates and deletes
CREATE POLICY "Admins can update roles" ON public.user_roles 
FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles" ON public.user_roles 
FOR DELETE USING (public.is_admin(auth.uid()));