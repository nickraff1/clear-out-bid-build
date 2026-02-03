-- Fix Security Issues: Error Level Only

-- =====================================================
-- 1. FIX: Unrestricted Notification Creation
-- Only allow service role (edge functions) to create notifications
-- =====================================================
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Service role (edge functions) can create notifications for any user
CREATE POLICY "Service role can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (
  -- Allow service role (used by edge functions)
  auth.jwt()->>'role' = 'service_role'
  -- OR allow users to create notifications for themselves only
  OR auth.uid() = user_id
);

-- =====================================================
-- 2. FIX: Simulated Payment Flow - Restrict Order Updates
-- Buyers should NOT be able to update status or payment_reference
-- =====================================================
DROP POLICY IF EXISTS "Involved parties can update orders" ON public.orders;

-- Buyers can only update non-critical fields (notes, pickup_slot_id)
CREATE POLICY "Buyers can update order details" 
ON public.orders 
FOR UPDATE 
USING (
  buyer_id = auth.uid() 
  OR is_org_member(auth.uid(), buyer_org_id)
);

-- Note: The WITH CHECK would need to compare OLD values, but Supabase RLS 
-- doesn't support OLD in WITH CHECK. Instead, we'll handle this via triggers.

-- Create a trigger to prevent buyers from updating critical fields
CREATE OR REPLACE FUNCTION public.protect_order_critical_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_service_role boolean;
  is_seller boolean;
  is_system_admin boolean;
BEGIN
  -- Check if this is service role (edge functions)
  is_service_role := (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role';
  
  -- Check if user is admin
  is_system_admin := is_admin(auth.uid());
  
  -- Check if user is seller (owns the event)
  SELECT EXISTS (
    SELECT 1 FROM clearance_events ce 
    WHERE ce.id = NEW.event_id 
    AND is_org_member(auth.uid(), ce.org_id)
  ) INTO is_seller;
  
  -- Service role and admins can update anything
  IF is_service_role OR is_system_admin THEN
    RETURN NEW;
  END IF;
  
  -- Sellers can update status to ready_for_pickup or collected
  IF is_seller THEN
    IF NEW.status IN ('ready_for_pickup', 'collected') OR NEW.status = OLD.status THEN
      -- Sellers cannot change payment fields
      IF NEW.payment_reference IS DISTINCT FROM OLD.payment_reference THEN
        RAISE EXCEPTION 'Cannot modify payment reference';
      END IF;
      IF NEW.amount IS DISTINCT FROM OLD.amount THEN
        RAISE EXCEPTION 'Cannot modify order amount';
      END IF;
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Sellers can only update status to ready_for_pickup or collected';
    END IF;
  END IF;
  
  -- Buyers cannot change critical fields
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cannot modify order status';
  END IF;
  
  IF NEW.payment_reference IS DISTINCT FROM OLD.payment_reference THEN
    RAISE EXCEPTION 'Cannot modify payment reference';
  END IF;
  
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION 'Cannot modify order amount';
  END IF;
  
  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id THEN
    RAISE EXCEPTION 'Cannot modify buyer';
  END IF;
  
  IF NEW.buyer_org_id IS DISTINCT FROM OLD.buyer_org_id THEN
    RAISE EXCEPTION 'Cannot modify buyer organization';
  END IF;
  
  IF NEW.lot_id IS DISTINCT FROM OLD.lot_id THEN
    RAISE EXCEPTION 'Cannot modify lot';
  END IF;
  
  IF NEW.event_id IS DISTINCT FROM OLD.event_id THEN
    RAISE EXCEPTION 'Cannot modify event';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_order_fields ON public.orders;
CREATE TRIGGER protect_order_fields
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_order_critical_fields();

-- =====================================================
-- 3. FIX: Customer Email Addresses Exposed
-- Restrict profiles to authenticated users viewing related profiles
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Users can view profiles of members in their organizations
CREATE POLICY "Users can view org member profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM org_members om1
    JOIN org_members om2 ON om1.org_id = om2.org_id
    WHERE om1.user_id = auth.uid()
    AND om2.user_id = profiles.id
  )
);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Sellers can view buyer profiles for their orders
CREATE POLICY "Sellers can view buyer profiles for orders" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN clearance_events ce ON ce.id = o.event_id
    WHERE o.buyer_id = profiles.id
    AND is_org_member(auth.uid(), ce.org_id)
  )
);

-- =====================================================
-- 4. FIX: Bidder Identities Revealed to All Users
-- Create a view for public bid info, restrict direct table access
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view bids on active lots" ON public.bids;

-- Bidders can view their own bids
CREATE POLICY "Users can view own bids" 
ON public.bids 
FOR SELECT 
USING (auth.uid() = user_id);

-- Lot owners can view all bids on their lots
CREATE POLICY "Lot owners can view bids on their lots" 
ON public.bids 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM lots l
    JOIN clearance_events ce ON ce.id = l.event_id
    WHERE l.id = bids.lot_id
    AND is_org_member(auth.uid(), ce.org_id)
  )
);

-- Admins can view all bids
CREATE POLICY "Admins can view all bids" 
ON public.bids 
FOR SELECT 
USING (is_admin(auth.uid()));

-- Create a view for anonymous bid statistics (amount, count) without user identity
CREATE OR REPLACE VIEW public.lot_bid_stats AS
SELECT 
  lot_id,
  COUNT(*) as bid_count,
  MAX(amount) as highest_bid,
  MIN(amount) as lowest_bid,
  COUNT(DISTINCT org_id) as unique_bidders
FROM public.bids
GROUP BY lot_id;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.lot_bid_stats TO authenticated;
GRANT SELECT ON public.lot_bid_stats TO anon;