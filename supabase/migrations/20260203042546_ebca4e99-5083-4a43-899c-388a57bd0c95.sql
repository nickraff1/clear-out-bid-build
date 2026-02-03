-- Fix the Security Definer View warning by recreating the view with SECURITY INVOKER
DROP VIEW IF EXISTS public.clearance_events_public;

CREATE VIEW public.clearance_events_public 
WITH (security_invoker = true) AS
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

-- Re-grant access to the public view
GRANT SELECT ON public.clearance_events_public TO anon, authenticated;