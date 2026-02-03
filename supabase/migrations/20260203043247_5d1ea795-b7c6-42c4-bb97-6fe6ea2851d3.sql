-- Fix infinite recursion in clearance_events and orders RLS policies
-- The recursion happens because clearance_events references orders and orders references clearance_events

-- Drop the problematic policies
DROP POLICY IF EXISTS "Org members and order buyers can view full events" ON public.clearance_events;
DROP POLICY IF EXISTS "Anyone can view active events basic info" ON public.clearance_events;

-- Create a security definer function to check if user has an order for an event
-- This breaks the recursion by using SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_order_for_event(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE event_id = _event_id 
    AND (buyer_id = _user_id OR is_org_member(_user_id, buyer_org_id))
  )
$$;

-- Create a security definer function to get seller org for an event
CREATE OR REPLACE FUNCTION public.get_event_org_id(_event_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.clearance_events WHERE id = _event_id
$$;

-- Recreate clearance_events policies without recursion
-- Anyone can view basic info for active events (public marketplace)
CREATE POLICY "Anyone can view active events"
ON public.clearance_events
FOR SELECT
USING (status = 'active');

-- Org members can see all their own events (any status)
CREATE POLICY "Org members can view own events"
ON public.clearance_events
FOR SELECT
USING (is_org_member(auth.uid(), org_id));

-- Admins can view all events
CREATE POLICY "Admins can view all events"
ON public.clearance_events
FOR SELECT
USING (is_admin(auth.uid()));

-- Users with orders can view those events
CREATE POLICY "Order buyers can view event details"
ON public.clearance_events
FOR SELECT
USING (has_order_for_event(auth.uid(), id));

-- Fix orders policy to use security definer function instead of join
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;

CREATE POLICY "Users can view own orders"
ON public.orders
FOR SELECT
USING (
  buyer_id = auth.uid() 
  OR is_org_member(auth.uid(), buyer_org_id) 
  OR is_admin(auth.uid()) 
  OR is_org_member(auth.uid(), get_event_org_id(event_id))
);