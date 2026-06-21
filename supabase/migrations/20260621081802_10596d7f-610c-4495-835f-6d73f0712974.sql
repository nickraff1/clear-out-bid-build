
-- Manual payout tracking for interim built-in Stripe Payments flow
-- (Stripe Connect scaffold preserved for future migration)

CREATE TYPE public.manual_payout_status AS ENUM (
  'manual_payout_pending',
  'manual_payout_paid',
  'manual_payout_failed',
  'manual_payout_on_hold'
);

CREATE TYPE public.payment_mode AS ENUM (
  'manual_payout_mode',
  'stripe_connect_mode'
);

ALTER TABLE public.payments
  ADD COLUMN payment_mode public.payment_mode NOT NULL DEFAULT 'manual_payout_mode',
  ADD COLUMN manual_payout_status public.manual_payout_status NOT NULL DEFAULT 'manual_payout_pending',
  ADD COLUMN manual_payout_paid_at timestamptz,
  ADD COLUMN manual_payout_reference text,
  ADD COLUMN admin_notes text,
  ADD COLUMN environment text NOT NULL DEFAULT 'sandbox';

-- Allow admins to update manual payout fields
CREATE POLICY "Admins can update payments"
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Update protect_order_critical_fields to allow service_role to move order to paid
-- (already allows service_role, no change needed)

-- Ensure order_status enum has 'paid' value (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='paid' AND enumtypid='order_status'::regtype) THEN
    ALTER TYPE public.order_status ADD VALUE 'paid';
  END IF;
END $$;
