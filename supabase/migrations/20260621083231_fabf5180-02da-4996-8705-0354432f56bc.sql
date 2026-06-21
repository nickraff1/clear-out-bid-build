
-- 1. Lots: reserved status + reservation tracking
ALTER TYPE lot_status ADD VALUE IF NOT EXISTS 'reserved';

ALTER TABLE public.lots
  ADD COLUMN IF NOT EXISTS reserved_order_id uuid,
  ADD COLUMN IF NOT EXISTS reserved_until timestamptz;

-- 2. Orders: pickup workflow fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_code text,
  ADD COLUMN IF NOT EXISTS pickup_status text NOT NULL DEFAULT 'awaiting_arrangement',
  ADD COLUMN IF NOT EXISTS proposed_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS proposed_pickup_by uuid,
  ADD COLUMN IF NOT EXISTS agreed_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- 3. Conversations link to order + system messages
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS order_id uuid;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- 4. Lot reports tied to orders
ALTER TABLE public.lot_reports
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS reporter_role text;

-- 5. Helper: generate a 6-char pickup code (uppercase alnum, no ambiguous chars)
CREATE OR REPLACE FUNCTION public.generate_pickup_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, 1 + floor(random()*length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 6. Update protect_order_critical_fields trigger to allow new fields by appropriate parties
CREATE OR REPLACE FUNCTION public.protect_order_critical_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_service_role boolean;
  is_seller boolean;
  is_system_admin boolean;
  is_buyer boolean;
BEGIN
  is_service_role := (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role';
  is_system_admin := is_admin(auth.uid());

  SELECT EXISTS (
    SELECT 1 FROM clearance_events ce
    WHERE ce.id = NEW.event_id
    AND is_org_member(auth.uid(), ce.org_id)
  ) INTO is_seller;

  is_buyer := auth.uid() = OLD.buyer_id;

  IF is_service_role OR is_system_admin THEN
    RETURN NEW;
  END IF;

  -- Hard-locked fields for everyone except service/admin
  IF NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
    OR NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
    OR NEW.buyer_org_id IS DISTINCT FROM OLD.buyer_org_id
    OR NEW.lot_id IS DISTINCT FROM OLD.lot_id
    OR NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.pickup_code IS DISTINCT FROM OLD.pickup_code
  THEN
    RAISE EXCEPTION 'Cannot modify locked order fields';
  END IF;

  IF is_seller THEN
    -- Sellers may move status forward to ready_for_pickup / collected and edit pickup fields
    IF NEW.status NOT IN (OLD.status, 'ready_for_pickup', 'collected') THEN
      RAISE EXCEPTION 'Invalid status transition for seller';
    END IF;
    RETURN NEW;
  END IF;

  IF is_buyer THEN
    -- Buyers may NOT change order status, but may update pickup proposal & collected marker
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Buyers cannot change order status';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not authorised to modify this order';
END;
$function$;
