CREATE OR REPLACE FUNCTION public.admin_set_payout_status(_payment_id uuid, _status text, _reference text DEFAULT NULL::text, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p record; ord record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
  IF _status NOT IN ('manual_payout_pending','manual_payout_paid','manual_payout_on_hold','manual_payout_failed') THEN
    RAISE EXCEPTION 'Invalid payout status';
  END IF;

  SELECT * INTO p FROM public.payments WHERE id=_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  IF _status='manual_payout_paid' THEN
    IF p.status <> 'succeeded' THEN RAISE EXCEPTION 'Cannot mark payout paid: payment is %', p.status; END IF;
    SELECT * INTO ord FROM public.orders WHERE id=p.order_id;
    IF ord.status IN ('cancelled','refunded') THEN
      RAISE EXCEPTION 'Cannot mark payout paid: order is %', ord.status;
    END IF;
  END IF;

  UPDATE public.payments SET
    manual_payout_status = _status::public.manual_payout_status,
    manual_payout_reference = COALESCE(_reference, manual_payout_reference),
    admin_notes = CASE WHEN _note IS NULL THEN admin_notes
                       ELSE COALESCE(admin_notes||E'\n','') || _note END,
    manual_payout_paid_at = CASE WHEN _status='manual_payout_paid' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id=_payment_id;
END $function$;