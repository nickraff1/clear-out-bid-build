-- One-time guarded reconciliation for the first live auction payment test.
-- Stripe accepted the off-session auction winner charge, but the webhook was
-- not subscribed to payment_intent.succeeded at the time, so the order stayed
-- pending in Offcutt. This repair is intentionally narrow and idempotent.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS auction_payment_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS auction_payment_error text;

DO $$
DECLARE
  target_order_id uuid := '17d0300a-c423-4e91-8010-36085e8ae170'::uuid;
  target_payment_intent text := 'pi_3TqPMbELbxGcXLeZ1f3V3XhD';
  target_amount numeric := 5.50;
  target_base numeric := 5.00;
  target_buyer_fee numeric := 0.50;
  target_seller_fee numeric := 0.50;
  target_seller_payout numeric := 4.50;
  repaired_order record;
  pickup text;
  seller_creator uuid;
  lot_title text;
  seller_org_id uuid;
  conversation_id uuid;
BEGIN
  SELECT
    o.*,
    l.title AS resolved_lot_title,
    e.org_id AS resolved_seller_org_id,
    e.created_by AS resolved_seller_creator
  INTO repaired_order
  FROM public.orders o
  JOIN public.lots l ON l.id = o.lot_id
  JOIN public.clearance_events e ON e.id = o.event_id
  WHERE o.id = target_order_id
    AND o.status = 'pending_payment'
    AND abs(o.amount - target_amount) < 0.001;

  IF NOT FOUND THEN
    RAISE NOTICE 'Live auction payment reconciliation skipped: target order is absent, not pending, or amount differs.';
    RETURN;
  END IF;

  INSERT INTO public.payments (
    order_id,
    stripe_payment_intent_id,
    amount_charged,
    base_amount,
    buyer_fee,
    seller_fee,
    seller_payout,
    status,
    payment_method,
    payment_mode,
    manual_payout_status,
    environment,
    error_message,
    updated_at
  )
  VALUES (
    target_order_id,
    target_payment_intent,
    target_amount,
    target_base,
    target_buyer_fee,
    target_seller_fee,
    target_seller_payout,
    'succeeded',
    'card',
    'manual_payout_mode',
    'manual_payout_pending',
    'live',
    NULL,
    now()
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.payments
  SET
    stripe_payment_intent_id = target_payment_intent,
    amount_charged = target_amount,
    base_amount = target_base,
    buyer_fee = target_buyer_fee,
    seller_fee = target_seller_fee,
    seller_payout = target_seller_payout,
    status = 'succeeded',
    payment_method = 'card',
    payment_mode = 'manual_payout_mode',
    manual_payout_status = COALESCE(manual_payout_status, 'manual_payout_pending'),
    environment = 'live',
    error_message = NULL,
    updated_at = now()
  WHERE order_id = target_order_id;

  pickup := public.generate_pickup_code();

  UPDATE public.orders
  SET
    status = 'paid',
    payment_reference = target_payment_intent,
    pickup_code = COALESCE(pickup_code, pickup),
    pickup_status = 'awaiting_arrangement',
    auction_payment_error = NULL,
    updated_at = now()
  WHERE id = target_order_id
    AND status = 'pending_payment';

  UPDATE public.lots
  SET
    status = 'sold',
    reserved_until = NULL,
    updated_at = now()
  WHERE id = repaired_order.lot_id;

  lot_title := COALESCE(repaired_order.resolved_lot_title, 'your lot');
  seller_org_id := repaired_order.resolved_seller_org_id;
  seller_creator := repaired_order.resolved_seller_creator;

  IF seller_org_id IS NOT NULL THEN
    INSERT INTO public.conversations (buyer_id, seller_org_id, lot_id, order_id, last_message_at)
    VALUES (repaired_order.buyer_id, seller_org_id, repaired_order.lot_id, target_order_id, now())
    ON CONFLICT (order_id) DO UPDATE SET
      buyer_id = EXCLUDED.buyer_id,
      seller_org_id = EXCLUDED.seller_org_id,
      lot_id = EXCLUDED.lot_id,
      last_message_at = GREATEST(public.conversations.last_message_at, now())
    RETURNING id INTO conversation_id;

    IF conversation_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.conversation_id = conversation_id
        AND m.is_system = true
        AND m.body = 'Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed.'
    ) THEN
      INSERT INTO public.messages (conversation_id, sender_id, is_system, body)
      VALUES (
        conversation_id,
        repaired_order.buyer_id,
        true,
        'Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed.'
      );
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = repaired_order.buyer_id
      AND n.type = 'order_paid'
      AND n.data ->> 'order_id' = target_order_id::text
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      repaired_order.buyer_id,
      'order_paid',
      'Payment received',
      format('Your payment for "%s" was successful. The seller has been notified — arrange pickup from your order page.', lot_title),
      jsonb_build_object('order_id', target_order_id)
    );
  END IF;

  IF seller_creator IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = seller_creator
      AND n.type = 'order_sold'
      AND n.data ->> 'order_id' = target_order_id::text
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      seller_creator,
      'order_sold',
      'Item sold',
      format('"%s" has been paid for. Arrange pickup with the buyer and mark it ready when prepared.', lot_title),
      jsonb_build_object('order_id', target_order_id)
    );
  END IF;

  RAISE NOTICE 'Live auction payment reconciled for order % with PaymentIntent %.', target_order_id, target_payment_intent;
END $$;
