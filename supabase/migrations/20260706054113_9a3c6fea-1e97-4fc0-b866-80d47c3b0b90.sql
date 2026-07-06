DROP VIEW IF EXISTS public.bidder_payment_method_summaries;

CREATE VIEW public.bidder_payment_method_summaries AS
SELECT
  id,
  user_id,
  environment,
  payment_method_brand,
  payment_method_last4,
  payment_method_verified_at,
  is_active,
  created_at,
  updated_at
FROM public.bidder_payment_methods
WHERE user_id = auth.uid() OR public.is_admin(auth.uid());

GRANT SELECT ON public.bidder_payment_method_summaries TO authenticated, service_role;