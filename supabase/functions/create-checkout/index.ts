// Creates a Stripe Embedded Checkout session for an existing pending_payment order.
// Uses dynamic price_data (one-off charge built from the order amount).
// Tracks platform fees (10% buyer + 10% seller) on the payments row.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { order_id, return_url, environment } = body as {
      order_id?: string; return_url?: string; environment?: StripeEnv;
    };
    if (!order_id || !return_url) {
      return new Response(JSON.stringify({ error: "Missing order_id or return_url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const env: StripeEnv = environment === "live" ? "live" : "sandbox";

    // Load order with related lot/event
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, buyer_id, amount, status, lot:lots(id, title), event:clearance_events(id, org_id)")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.buyer_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.status !== "pending_payment") {
      return new Response(JSON.stringify({ error: `Order already ${order.status}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute fee breakdown from total `amount` (already includes 10% buyer fee)
    const total = Number(order.amount);
    const basePrice = Math.round((total / 1.10) * 100) / 100;
    const buyerFee = Math.round((total - basePrice) * 100) / 100;
    const sellerFee = Math.round(basePrice * 0.10 * 100) / 100;
    const sellerPayout = Math.round((basePrice - sellerFee) * 100) / 100;

    const stripe = createStripeClient(env);
    const lotTitle: string = (order as any).lot?.title ?? "Offcutt order";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      return_url,
      customer_email: user.email ?? undefined,
      line_items: [{
        price_data: {
          currency: "aud",
          product_data: { name: lotTitle, description: `Offcutt order #${order.id.slice(0, 8)}` },
          unit_amount: Math.round(total * 100),
        },
        quantity: 1,
      }],
      payment_intent_data: { description: lotTitle },
      metadata: {
        order_id: order.id,
        buyer_id: user.id,
        base_amount: basePrice.toFixed(2),
        buyer_fee: buyerFee.toFixed(2),
        seller_fee: sellerFee.toFixed(2),
        seller_payout: sellerPayout.toFixed(2),
      },
    } as any);

    // Upsert payment row tied to this order
    const { data: existing } = await admin
      .from("payments").select("id").eq("order_id", order.id).maybeSingle();

    const paymentRow = {
      order_id: order.id,
      stripe_session_id: session.id,
      base_amount: basePrice,
      buyer_fee: buyerFee,
      seller_fee: sellerFee,
      seller_payout: sellerPayout,
      amount_charged: total,
      application_fee_amount: buyerFee + sellerFee,
      status: "pending",
      payment_mode: "manual_payout_mode",
      manual_payout_status: "manual_payout_pending",
      environment: env,
    };
    if (existing) {
      await admin.from("payments").update(paymentRow).eq("id", existing.id);
    } else {
      await admin.from("payments").insert(paymentRow);
    }

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("create-checkout error", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});