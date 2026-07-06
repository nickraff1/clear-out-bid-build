ALTER TABLE public.bidder_payment_methods
  DROP CONSTRAINT IF EXISTS bidder_payment_methods_user_id_fkey;

REVOKE SELECT ON public.bidder_payment_methods FROM authenticated;

CREATE OR REPLACE VIEW public.bidder_payment_method_summaries AS
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
FROM public.bidder_payment_methods;

ALTER VIEW public.bidder_payment_method_summaries SET (security_invoker = true);

GRANT SELECT ON public.bidder_payment_method_summaries TO authenticated, service_role;