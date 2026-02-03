-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'refunded');

-- Create payments table for tracking all transactions
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  amount_charged NUMERIC NOT NULL,
  base_amount NUMERIC NOT NULL,
  buyer_fee NUMERIC NOT NULL DEFAULT 0,
  seller_fee NUMERIC NOT NULL DEFAULT 0,
  seller_payout NUMERIC NOT NULL DEFAULT 0,
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create seller stripe accounts table
CREATE TABLE public.seller_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  stripe_account_id TEXT,
  onboarding_complete BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  details_submitted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Payment policies: Users can view payments for their orders
CREATE POLICY "Users can view their own payments" ON public.payments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = payments.order_id
    AND (
      o.buyer_id = auth.uid()
      OR public.is_org_member(auth.uid(), o.buyer_org_id)
      OR EXISTS (
        SELECT 1 FROM public.clearance_events ce
        WHERE ce.id = o.event_id
        AND public.is_org_member(auth.uid(), ce.org_id)
      )
      OR public.is_admin(auth.uid())
    )
  )
);

-- System can create payments (via edge functions)
CREATE POLICY "System can create payments" ON public.payments
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- System can update payments (via edge functions/webhooks)
CREATE POLICY "System can update payments" ON public.payments
FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Seller Stripe Account policies
CREATE POLICY "Org members can view their stripe account" ON public.seller_stripe_accounts
FOR SELECT USING (
  public.is_org_member(auth.uid(), org_id)
  OR public.is_admin(auth.uid())
);

CREATE POLICY "Org members can create stripe account" ON public.seller_stripe_accounts
FOR INSERT WITH CHECK (
  public.is_org_member(auth.uid(), org_id)
);

CREATE POLICY "Org members can update stripe account" ON public.seller_stripe_accounts
FOR UPDATE USING (
  public.is_org_member(auth.uid(), org_id)
  OR public.is_admin(auth.uid())
);

-- Add trigger for updated_at on both tables
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seller_stripe_accounts_updated_at
BEFORE UPDATE ON public.seller_stripe_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster payment lookups
CREATE INDEX idx_payments_order_id ON public.payments(order_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_seller_stripe_accounts_org_id ON public.seller_stripe_accounts(org_id);