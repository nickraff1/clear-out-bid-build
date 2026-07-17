import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, resolveConfiguredPaymentEnvironment, type StripeEnv } from "./stripe.ts";
import { completePaidOrder } from "./paid-order.ts";

type SupabaseAdmin = ReturnType<typeof createClient>;

type OrderForCharge = {
  id: string;
  buyer_id: string;
  amount: number;
  status: string;
  auction_payment_environment?: StripeEnv | null;
  lot?: { id: string; title?: string | null; pricing_type?: string | null } | null;
};

type BidderVerification = {
  stripe_customer_id?: string | null;
  stripe_payment_method_id?: string | null;
};

type PaymentRow = { id: string };

async function notifyAuctionPaymentActionNeeded(
  sb: SupabaseAdmin,
  order: OrderForCharge,
  message: string,
) {
  await sb.from("notifications").insert({
    user_id: order.buyer_id,
    type: "auction_payment_action_required",
    title: "Auction payment needs attention",
    message,
    link_url: `/app/orders/${order.id}?guide=1`,
    related_order_id: order.id,
    related_lot_id: order.lot?.id,
    data: {
      order_id: order.id,
      lot_id: order.lot?.id,
      source: "auction_winner_auto_charge",
    },
  });
}

export async function chargeAuctionWinnerOrder(
  sb: SupabaseAdmin,
  args: { orderId: string; env?: StripeEnv },
) {
  const { data: orderData, error: orderError } = await sb
    .from("orders")
    .select("id, buyer_id, amount, status, auction_payment_environment, lot:lots(id, title, pricing_type)")
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

  const env = args.env ?? order.auction_payment_environment ?? await resolveConfiguredPaymentEnvironment(sb);

  const { data: savedMethodData } = await sb
    .from("bidder_payment_methods")
    .select("stripe_customer_id, stripe_payment_method_id")
    .eq("user_id", order.buyer_id)
    .eq("environment", env)
    .eq("is_active", true)
    .maybeSingle();
  const bidder = savedMethodData as BidderVerification | null;
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
    await notifyAuctionPaymentActionNeeded(
      sb,
      order,
      `You won "${order.lot?.title ?? "an auction"}", but Offcutt could not find a verified saved card. Please pay from your orders page to secure the item.`,
    );
    return { ok: false, error: "payment_method_required" };
  }

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

    const chargeId = typeof intent.latest_charge === "string"
      ? intent.latest_charge
      : intent.latest_charge?.id ?? null;
    if (!chargeId) {
      throw new Error("Succeeded auction payment did not return a Stripe Charge ID");
    }
    const charge = await stripe.charges.retrieve(chargeId, {
      expand: ["balance_transaction"],
    });
    const balance = typeof charge.balance_transaction === "string"
      ? null
      : charge.balance_transaction;
    const balanceTransactionId = typeof charge.balance_transaction === "string"
      ? charge.balance_transaction
      : charge.balance_transaction?.id ?? null;

    await sb.from("payments").update({
      status: "succeeded",
      stripe_payment_intent_id: intent.id,
      stripe_charge_id: charge.id,
      stripe_charge_amount: charge.amount / 100,
      stripe_charge_currency: charge.currency.toLowerCase(),
      stripe_balance_transaction_id: balanceTransactionId,
      stripe_charge_available_on: balance?.available_on
        ? new Date(balance.available_on * 1000).toISOString()
        : null,
      stripe_charge_settlement_status: balance?.status === "available"
        ? "available"
        : balance?.status === "pending"
        ? "pending"
        : "unknown",
      payment_method: "card",
      environment: env,
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", paymentId);

    await completePaidOrder(sb, {
      orderId: order.id,
      paymentReference: intent.id,
    });

    return {
      ok: true,
      order_id: order.id,
      payment_intent_id: intent.id,
      charge_id: charge.id,
    };
  } catch (err) {
    const message = (err as Error).message;
    await sb.from("payments").update({
      status: "failed",
      error_message: message,
      environment: env,
      updated_at: new Date().toISOString(),
    }).eq("id", paymentId);
    await sb.from("orders").update({
      auction_payment_attempted_at: new Date().toISOString(),
      auction_payment_error: message,
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);
    await notifyAuctionPaymentActionNeeded(
      sb,
      order,
      `Your saved card could not be charged for "${order.lot?.title ?? "your auction win"}". Please pay from your orders page or contact Offcutt support.`,
    );
    return { ok: false, order_id: order.id, error: message };
  }
}
