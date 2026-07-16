-- A real Stripe Transfer ID is authoritative. Repair historical rows created
-- before payout_processing_status existed so admin accounting cannot describe
-- an accepted transfer as merely pending.

UPDATE public.payments
SET
  payout_processing_status = CASE
    WHEN stripe_charge_settlement_status = 'pending' THEN 'awaiting_stripe_settlement'
    ELSE 'transferred'
  END,
  updated_at = now()
WHERE stripe_transfer_id ~ '^tr_'
  AND payout_processing_status NOT IN ('transferred', 'awaiting_stripe_settlement');
