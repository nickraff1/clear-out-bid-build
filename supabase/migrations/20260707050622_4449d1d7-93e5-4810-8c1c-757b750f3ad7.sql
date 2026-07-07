
-- Defensive: add missing columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS auction_payment_attempted_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS auction_payment_error text;

DO $$
DECLARE
  v_order_id uuid := '17d0300a-c423-4e91-8010-36085e8ae170';
  v_pi text := 'pi_3TqPMbELbxGcXLeZ1f3V3XhD';
  v_order record;
  v_payment_id uuid;
  v_pickup_code text;
  v_seller_org uuid;
  v_seller_creator uuid;
  v_lot_title text;
  v_conv_id uuid;
  v_sys_msg text := 'Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed.';
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id;
  IF NOT FOUND THEN RAISE NOTICE 'Order not found; aborting'; RETURN; END IF;
  IF v_order.status <> 'pending_payment' THEN RAISE NOTICE 'Order status is %, not pending_payment; aborting', v_order.status; RETURN; END IF;
  IF v_order.amount <> 5.50 THEN RAISE NOTICE 'Order amount is %, not 5.50; aborting', v_order.amount; RETURN; END IF;

  -- 1. Payments row upsert
  SELECT id INTO v_payment_id FROM public.payments WHERE order_id = v_order_id LIMIT 1;
  IF v_payment_id IS NULL THEN
    INSERT INTO public.payments (order_id, status, stripe_payment_intent_id, amount_charged,
      base_amount, buyer_fee, seller_fee, seller_payout, application_fee_amount,
      payment_method, payment_mode, manual_payout_status, environment, error_message, updated_at)
    VALUES (v_order_id, 'succeeded', v_pi, 5.50, 5.00, 0.50, 0.50, 4.50, 1.00,
      'card', 'manual_payout_mode', 'manual_payout_pending', 'live', NULL, now())
    RETURNING id INTO v_payment_id;
  ELSE
    UPDATE public.payments SET
      status = 'succeeded',
      stripe_payment_intent_id = v_pi,
      amount_charged = 5.50,
      base_amount = 5.00,
      buyer_fee = 0.50,
      seller_fee = 0.50,
      seller_payout = 4.50,
      application_fee_amount = 1.00,
      payment_method = 'card',
      payment_mode = 'manual_payout_mode',
      manual_payout_status = 'manual_payout_pending',
      environment = 'live',
      error_message = NULL,
      updated_at = now()
    WHERE id = v_payment_id;
  END IF;

  -- 2. Update order (bypass user triggers, mirroring admin_force_complete_order pattern)
  v_pickup_code := COALESCE(v_order.pickup_code, public.generate_pickup_code());
  ALTER TABLE public.orders DISABLE TRIGGER USER;
  UPDATE public.orders SET
    status = 'paid',
    payment_reference = v_pi,
    pickup_code = v_pickup_code,
    pickup_status = 'awaiting_arrangement',
    auction_payment_error = NULL,
    admin_notes = COALESCE(admin_notes || E'\n','') || 'Reconciled to paid via admin one-time repair (webhook missed pi_3TqPMbELbxGcXLeZ1f3V3XhD)',
    updated_at = now()
  WHERE id = v_order_id;
  ALTER TABLE public.orders ENABLE TRIGGER USER;

  -- 3. Update lot
  UPDATE public.lots SET status = 'sold', reserved_until = NULL, updated_at = now()
  WHERE id = v_order.lot_id;

  -- Lookup seller org + creator + lot title
  SELECT ce.org_id, ce.created_by, l.title
    INTO v_seller_org, v_seller_creator, v_lot_title
  FROM public.lots l JOIN public.clearance_events ce ON ce.id = l.event_id
  WHERE l.id = v_order.lot_id;

  -- 4. Conversation upsert
  IF v_seller_org IS NOT NULL THEN
    INSERT INTO public.conversations (buyer_id, seller_org_id, lot_id, order_id)
    VALUES (v_order.buyer_id, v_seller_org, v_order.lot_id, v_order_id)
    ON CONFLICT (order_id) DO UPDATE SET seller_org_id = EXCLUDED.seller_org_id
    RETURNING id INTO v_conv_id;

    -- 5. System message if missing
    IF v_conv_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.messages
      WHERE conversation_id = v_conv_id AND is_system = true AND body = v_sys_msg
    ) THEN
      INSERT INTO public.messages (conversation_id, sender_id, is_system, body)
      VALUES (v_conv_id, v_order.buyer_id, true, v_sys_msg);
    END IF;
  END IF;

  -- 6. Notifications (buyer + seller) if missing
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = v_order.buyer_id AND type = 'order_paid'
      AND (data->>'order_id') = v_order_id::text
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (v_order.buyer_id, 'order_paid', 'Payment received',
      format('Your payment for "%s" was successful. The seller has been notified — arrange pickup from your order page.', COALESCE(v_lot_title,'your lot')),
      jsonb_build_object('order_id', v_order_id));
  END IF;

  IF v_seller_creator IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = v_seller_creator AND type = 'order_sold'
      AND (data->>'order_id') = v_order_id::text
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (v_seller_creator, 'order_sold', 'Item sold',
      format('"%s" has been paid for. Arrange pickup with the buyer and mark it ready when prepared.', COALESCE(v_lot_title,'your lot')),
      jsonb_build_object('order_id', v_order_id));
  END IF;

  -- 7. Audit log
  IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.admin_audit_logs (actor_id, action, entity_type, entity_id, metadata)
      VALUES (NULL, 'reconcile_stripe_payment', 'order', v_order_id,
        jsonb_build_object('payment_intent_id', v_pi, 'amount', 5.50, 'environment', 'live',
          'reason', 'Webhook was not subscribed to payment_intent.succeeded when charge occurred'));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'admin_audit_logs insert skipped: %', SQLERRM;
    END;
  END IF;

  RAISE NOTICE 'Reconciled order % (pickup_code=%, conversation=%)', v_order_id, v_pickup_code, v_conv_id;
END $$;
