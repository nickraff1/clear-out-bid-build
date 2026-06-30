import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv } from "./stripe.ts";
import { completePaidOrder } from "./paid-order.ts";

type SupabaseAdmin = ReturnType<typeof createClient>;

type OrderForCharge = {
  id: string;
  buyer_id: string;
  amount: number;
  status: string;
  lot?: { id: string; title?: string | null; pricing_type?: string | null } | null;
};

type BidderVerification = {
  stripe_customer_id?: string | null;
  stripe_payment_method_id?: string | null;
};

type PaymentRow = { id: string };

export async function resolvePaymentEnvironment(sb: SupabaseAdmin): Promise<StripeEnv> {
  const { data: settings } = await sb
    .from("auction_deposit_settings")
    .select("current_gateway_mode")
    .eq("singleton", true)
    .maybeSingle();
  const mode = (settings?.current_gateway_mode as string | undefined) ?? "lovable_gateway_sandbox";
  if (mode === "lovable_gateway_live") {
    if (Deno.env.get("ENABLE_LIVE_PAYMENTS") !== "true") {
      throw new Error("Live payment mode is configured but ENABLE_LIVE_PAYMENTS is not true");
    }
    return "live";
  }
  return "sandbox";
}

export async function chargeAuctionWinnerOrder(
  sb: SupabaseAdmin,
  args: { orderId: string; env?: StripeEnv },
) {
  const { data: orderData, error: orderError } = await sb
    .from("orders")
    .select("id, buyer_id, amount, status, lot:lots(id, title, pricing_type)")
    .eq("id", args.orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  const order = orderData as unknown as OrderForCharge | null;
  if (!order) return { ok: false, skipped: "order_not_found" };
  if (order.status !== "pending_payment") return { ok: true, skipped: `order_${order.status}` };
  if (order.lot?.pricing_type !== "auction") return { ok: true, skipped: "not_auction_order" };

  const { data: succeeded } = await sb.from("payments")
    .select("id")
    .eq("order_id", order.id)
    .eq("status", "succeeded")
    .maybeSingle();
  if (succeeded) return { ok: true, skipped: "already_paid" };

  const { data: bvData } = await sb
    .from("bidder_verifications")
    .select("stripe_customer_id, stripe_payment_method_id")
    .eq("user_id", order.buyer_id)
    .maybeSingle();
  const bidder = bvData as BidderVerification | null;
  if (!bidder?.stripe_customer_id || !bidder?.stripe_payment_method_id) {
    const message = "Winner has no verified card on file";
    await sb.from("orders").update({
      auction_payment_attempted_at: new Date().toISOString(),
      auction_payment_error: message,
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);
    await sb.from("bidder_verifications").update({
      failed_payment_count: 1,
      updated_at: new Date().toISOString(),
    }).eq("user_id", order.buyer_id);
    return { ok: false, error: "payment_method_required" };
  }

  const env = args.env ?? await resolvePaymentEnvironment(sb);
  const stripe = createStripeClient(env);
  const total = Number(order.amount);
  const basePrice = Math.round((total / 1.10) * 100) / 100;
  const buyerFee = Math.round((total - basePrice) * 100) / 100;
  const sellerFee = Math.round(basePrice * 0.10 * 100) / 100;
  const sellerPayout = Math.round((basePrice - sellerFee) * 100) / 100;

  const { data: existingPayment } = await sb
    .from("payments")
    .select("id")
    .eq("order_id", order.id)
    .maybeSingle();

  const paymentRow = {
    order_id: order.id,
    base_amount: basePrice,
    buyer_fee: buyerFee,
    seller_fee: sellerFee,
    seller_payout: sellerPayout,
    amount_charged: total,
    application_fee_amount: buyerFee + sellerFee,
    status: "processing",
    payment_mode: "manual_payout_mode",
    manual_payout_status: "manual_payout_pending",
    environment: env,
    updated_at: new Date().toISOString(),
  };

  let paymentId = (existingPayment as PaymentRow | null)?.id ?? null;
  if (paymentId) {
    await sb.from("payments").update(paymentRow).eq("id", paymentId);
  } else {
    const { data: inserted, error: insertError } = await sb.from("payments")
      .insert(paymentRow)
      .select("id")
      .single();
    if (insertError) throw insertError;
    paymentId = (inserted as PaymentRow).id;
  }

  await sb.from("orders").update({
    auction_payment_attempted_at: new Date().toISOString(),
    auction_payment_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", order.id);

  try {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: "aud",
      customer: bidder.stripe_customer_id,
      payment_method: bidder.stripe_payment_method_id,
      confirm: true,
      off_session: true,
      description: `Winning auction payment for ${order.lot?.title ?? "Offcutt auction"}`,
      metadata: {
        order_id: order.id,
        buyer_id: order.buyer_id,
        source: "auction_winner_auto_charge",
        base_amount: basePrice.toFixed(2),
        buyer_fee: buyerFee.toFixed(2),
        seller_fee: sellerFee.toFixed(2),
        seller_payout: sellerPayout.toFixed(2),
      },
    });

    if (intent.status !== "succeeded") {
      throw new Error(`PaymentIntent status: ${intent.status}`);
    }

    await sb.from("payments").update({
      status: "succeeded",
      stripe_payment_intent_id: intent.id,
      payment_method: "card",
      environment: env,
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", paymentId);

    await completePaidOrder(sb, {
      orderId: order.id,
      paymentReference: intent.id,
    });

    return { ok: true, order_id: order.id, payment_intent_id: intent.id };
  } catch (err) {
    const message = (err as Error).message;
    await sb.from("payments").update({
      status: "failed",
      error_message: message,
      environment: env,
      updated_at: new Date().toISOString(),
    }).eq("id", paymentId);
    await sb.from("orders").update({
      auction_payment_error: message,
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);
    await sb.rpc("handle_defaulted_winner", { _order_id: order.id });
    return { ok: false, order_id: order.id, error: message };
  }
}
