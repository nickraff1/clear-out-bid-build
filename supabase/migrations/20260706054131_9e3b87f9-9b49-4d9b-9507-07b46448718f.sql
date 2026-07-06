DROP VIEW IF EXISTS public.bidder_payment_method_summaries;

REVOKE SELECT ON public.bidder_payment_methods FROM authenticated;

GRANT SELECT (
  id,
  user_id,
  environment,
  payment_method_brand,
  payment_method_last4,
  payment_method_verified_at,
  is_active,
  created_at,
  updated_at
) ON public.bidder_payment_methods TO authenticated;

GRANT ALL ON public.bidder_payment_methods TO service_role;