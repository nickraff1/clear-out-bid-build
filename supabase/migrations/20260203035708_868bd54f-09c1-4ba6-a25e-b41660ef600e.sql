-- Fix Security Definer View issue
-- Drop the view and recreate with SECURITY INVOKER (default, more secure)
DROP VIEW IF EXISTS public.lot_bid_stats;

CREATE VIEW public.lot_bid_stats 
WITH (security_invoker = true)
AS
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