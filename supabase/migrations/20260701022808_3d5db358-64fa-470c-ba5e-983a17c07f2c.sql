-- Phase 2A pre-live cleanup: cancel QA/test lots that haven't been sold, and cancel any lingering pending payment orders on them.
UPDATE public.orders
SET status = 'cancelled', updated_at = now()
WHERE status IN ('pending_payment')
  AND lot_id IN (
    SELECT id FROM public.lots
    WHERE status IN ('active','draft','unsold','reserved','expired')
      AND (title ILIKE '%QA%' OR title ILIKE '%test%' OR title ILIKE '%seed%')
  );

UPDATE public.lots
SET status = 'cancelled', reserved_until = NULL, updated_at = now()
WHERE status IN ('active','draft','unsold','reserved','expired')
  AND (title ILIKE '%QA%' OR title ILIKE '%test%' OR title ILIKE '%seed%');
