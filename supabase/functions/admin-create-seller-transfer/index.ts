import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

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
    if (Deno.env.get("ENABLE_AUTOMATED_PAYOUTS") !== "true") {
      throw new Error("Automated seller transfers are disabled. Set ENABLE_AUTOMATED_PAYOUTS=true only after payout QA and owner approval.");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
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
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const paymentId = body?.payment_id as string | undefined;
    const note = (body?.note as string | undefined) ?? "Automated seller transfer";
    if (!paymentId) {
      return new Response(JSON.stringify({ error: "payment_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select(`
        id, order_id, status, seller_payout, stripe_transfer_id, environment, manual_payout_status,
        order:orders!payments_order_id_fkey(
          id, status, pickup_status,
          lot:lots(id, title, event:clearance_events(org_id))
        )
      `)
      .eq("id", paymentId)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "succeeded") throw new Error(`Cannot transfer payout: payment is ${payment.status}`);
    if (payment.stripe_transfer_id) return new Response(JSON.stringify({ ok: true, skipped: "already_transferred", transfer_id: payment.stripe_transfer_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    if (payment.order?.status !== "collected") {
      throw new Error("Order must be collected before automated seller transfer");
    }

    const { data: openIssue } = await admin.from("lot_reports")
      .select("id")
      .eq("order_id", payment.order_id)
      .in("status", ["open", "investigating"])
      .maybeSingle();
    if (openIssue) throw new Error("Open issue exists. Resolve or dismiss the issue before transfer.");

    const sellerOrgId = payment.order?.lot?.event?.org_id;
    if (!sellerOrgId) throw new Error("Seller organisation not found");

    const { data: sellerAccount } = await admin
      .from("seller_stripe_accounts")
      .select("stripe_account_id, payouts_enabled, charges_enabled, account_status")
      .eq("org_id", sellerOrgId)
      .maybeSingle();
    if (!sellerAccount?.stripe_account_id) throw new Error("Seller has no Stripe Connect account");
    if (!sellerAccount.payouts_enabled) throw new Error("Seller Stripe payouts are not enabled");

    const env: StripeEnv = payment.environment === "live" ? "live" : "sandbox";
    if (env === "live" && Deno.env.get("ENABLE_LIVE_PAYMENTS") !== "true") {
      throw new Error("Live transfers are blocked because ENABLE_LIVE_PAYMENTS is not true");
    }

    const stripe = createStripeClient(env);
    const transfer = await stripe.transfers.create({
      amount: Math.round(Number(payment.seller_payout) * 100),
      currency: "aud",
      destination: sellerAccount.stripe_account_id,
      metadata: {
        payment_id: payment.id,
        order_id: payment.order_id,
        seller_org_id: sellerOrgId,
      },
      description: `Offcutt seller payout for order ${payment.order_id.slice(0, 8)}`,
    });

    await admin.from("payments").update({
      payment_mode: "stripe_connect_mode",
      manual_payout_status: "manual_payout_paid",
      manual_payout_reference: transfer.id,
      manual_payout_paid_at: new Date().toISOString(),
      stripe_transfer_id: transfer.id,
      admin_notes: note,
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);

    return new Response(JSON.stringify({ ok: true, transfer_id: transfer.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-create-seller-transfer error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
