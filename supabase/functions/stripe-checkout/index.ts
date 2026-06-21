// Creates a Stripe Checkout Session for an order, with marketplace splits.
// TODO: Add STRIPE_SECRET_KEY in Backend → Secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured. Add STRIPE_SECRET_KEY in Backend → Secrets." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { order_id, success_url, cancel_url } = await req.json();

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, lot:lots(title, event_id), event:clearance_events(org_id)")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: corsHeaders });
    }
    if (order.buyer_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { data: fees } = await supabase.from("fee_settings").select("*").maybeSingle();
    const buyerFeePct = Number(fees?.buyer_fee_pct ?? 0.05);
    const sellerFeePct = Number(fees?.seller_fee_pct ?? 0.05);

    const base = Number(order.amount);
    const buyerFee = Math.round(base * buyerFeePct * 100) / 100;
    const sellerFee = Math.round(base * sellerFeePct * 100) / 100;
    const total = base + buyerFee;
    const applicationFee = buyerFee + sellerFee;

    // Seller Stripe account
    const { data: stripeAccount } = await supabase
      .from("seller_stripe_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("org_id", (order as any).event.org_id)
      .maybeSingle();

    const Stripe = (await import("https://esm.sh/stripe@14.21.0?target=deno")).default;
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const sessionParams: any = {
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "aud",
          product_data: { name: (order as any).lot.title },
          unit_amount: Math.round(total * 100),
        },
        quantity: 1,
      }],
      success_url,
      cancel_url,
      metadata: { order_id, buyer_id: user.id },
      payment_intent_data: {
        application_fee_amount: Math.round(applicationFee * 100),
      },
    };

    if (stripeAccount?.stripe_account_id && stripeAccount.charges_enabled) {
      sessionParams.payment_intent_data.transfer_data = {
        destination: stripeAccount.stripe_account_id,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    await supabase.from("payments").insert({
      order_id,
      base_amount: base,
      buyer_fee: buyerFee,
      seller_fee: sellerFee,
      seller_payout: base - sellerFee,
      amount_charged: total,
      application_fee_amount: applicationFee,
      stripe_session_id: session.id,
      status: "pending",
    });

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});