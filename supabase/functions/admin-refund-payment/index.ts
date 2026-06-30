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
    const amount = body?.amount == null ? undefined : Number(body.amount);
    const reason = (body?.reason as string | undefined) ?? "requested_by_customer";
    const notes = (body?.notes as string | undefined) ?? null;
    if (!paymentId) {
      return new Response(JSON.stringify({ error: "payment_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("id, order_id, status, amount_charged, refunded_amount, stripe_payment_intent_id, environment, manual_payout_status")
      .eq("id", paymentId)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== "succeeded") throw new Error(`Cannot refund payment with status ${payment.status}`);
    if (!payment.stripe_payment_intent_id) throw new Error("Payment has no Stripe payment intent");
    if (payment.manual_payout_status === "manual_payout_paid") {
      throw new Error("Payout is already marked paid. Put the payout on hold and reconcile manually before refunding.");
    }

    const remaining = Number(payment.amount_charged) - Number(payment.refunded_amount ?? 0);
    const refundAmount = amount == null ? remaining : amount;
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) throw new Error("Refund amount must be positive");
    if (refundAmount > remaining) throw new Error("Refund amount exceeds remaining refundable balance");

    const env: StripeEnv = payment.environment === "live" ? "live" : "sandbox";
    if (env === "live" && Deno.env.get("ENABLE_LIVE_PAYMENTS") !== "true") {
      throw new Error("Live refunds are blocked because ENABLE_LIVE_PAYMENTS is not true");
    }

    const { data: refundRow, error: refundInsertError } = await admin.from("payment_refunds").insert({
      payment_id: payment.id,
      order_id: payment.order_id,
      amount: refundAmount,
      status: "requested",
      reason,
      admin_id: user.id,
      admin_notes: notes,
    }).select("id").single();
    if (refundInsertError) throw refundInsertError;

    try {
      const stripe = createStripeClient(env);
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripe_payment_intent_id,
        amount: Math.round(refundAmount * 100),
        reason: reason as "duplicate" | "fraudulent" | "requested_by_customer",
        metadata: {
          payment_id: payment.id,
          order_id: payment.order_id,
          refund_row_id: refundRow.id,
        },
      });

      const refundedTotal = Math.round((Number(payment.refunded_amount ?? 0) + refundAmount) * 100) / 100;
      const fullyRefunded = refundedTotal >= Number(payment.amount_charged);

      await admin.from("payment_refunds").update({
        status: "succeeded",
        stripe_refund_id: refund.id,
        updated_at: new Date().toISOString(),
      }).eq("id", refundRow.id);

      await admin.from("payments").update({
        status: fullyRefunded ? "refunded" : "succeeded",
        refund_status: fullyRefunded ? "succeeded" : "partial",
        refunded_amount: refundedTotal,
        stripe_refund_id: refund.id,
        manual_payout_status: "manual_payout_on_hold",
        admin_notes: notes ? `Refund: ${notes}` : "Refund processed",
        updated_at: new Date().toISOString(),
      }).eq("id", payment.id);

      await admin.from("orders").update({
        status: fullyRefunded ? "cancelled" : "disputed",
        admin_notes: notes ? `Refund: ${notes}` : "Refund processed",
        updated_at: new Date().toISOString(),
      }).eq("id", payment.order_id);

      return new Response(JSON.stringify({ ok: true, refund_id: refund.id, fully_refunded: fullyRefunded }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (stripeError) {
      await admin.from("payment_refunds").update({
        status: "failed",
        error_message: (stripeError as Error).message,
        updated_at: new Date().toISOString(),
      }).eq("id", refundRow.id);
      throw stripeError;
    }
  } catch (err) {
    console.error("admin-refund-payment error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
