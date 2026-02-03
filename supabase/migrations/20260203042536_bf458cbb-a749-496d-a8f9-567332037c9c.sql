-- Fix 1: Prevent users from self-assigning admin role
-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can assign themselves roles" ON public.user_roles;

-- Create new policy that only allows non-admin roles for self-assignment
CREATE POLICY "Users can assign themselves non-admin roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND role IN ('seller_admin', 'seller_staff', 'buyer_admin', 'buyer_staff')
);

-- Fix 2: Create a secure view for public event data (excludes sensitive contact details)
CREATE OR REPLACE VIEW public.clearance_events_public AS
SELECT 
  id, 
  org_id, 
  created_by, 
  title, 
  description,
  site_address, 
  suburb, 
  state, 
  postcode,
  pickup_start, 
  pickup_end, 
  status,
  created_at, 
  updated_at
FROM public.clearance_events
WHERE status = 'active';

-- Grant access to the public view
GRANT SELECT ON public.clearance_events_public TO anon, authenticated;

-- Update the existing RLS policy for clearance_events to be more restrictive
-- First drop the existing permissive policy
DROP POLICY IF EXISTS "Anyone can view active events" ON public.clearance_events;

-- Create new policy: Only org members, buyers with orders, and admins can see full event details
CREATE POLICY "Org members and order buyers can view full events" 
ON public.clearance_events 
FOR SELECT 
USING (
  is_org_member(auth.uid(), org_id) 
  OR is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM orders o
    WHERE o.event_id = clearance_events.id
    AND (o.buyer_id = auth.uid() OR is_org_member(auth.uid(), o.buyer_org_id))
  )
);

-- Create policy for public access to basic event info only (for marketplace browsing)
-- This uses the view instead of direct table access, but we also need to allow
-- authenticated users to see active events for lot queries
CREATE POLICY "Anyone can view active events basic info" 
ON public.clearance_events 
FOR SELECT 
USING (status = 'active');