import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  createStripeClient,
  normalizeRequestedEnvironment,
  resolveConfiguredPaymentEnvironment,
} from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const setupIntentId = body?.setup_intent_id as string | undefined;
    const requestedEnvironment = body?.environment as string | undefined;
    if (!setupIntentId) {
      return new Response(JSON.stringify({ error: "setup_intent_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const env = requestedEnvironment
      ? normalizeRequestedEnvironment(requestedEnvironment)
      : await resolveConfiguredPaymentEnvironment(admin);
    const stripe = createStripeClient(env);

    const intent = await stripe.setupIntents.retrieve(setupIntentId);
    if (intent.metadata?.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Intent does not belong to user" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (intent.status !== "succeeded") {
      return new Response(JSON.stringify({ error: `SetupIntent status: ${intent.status}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pmId = typeof intent.payment_method === "string"
      ? intent.payment_method
      : intent.payment_method?.id;
    const customerId = typeof intent.customer === "string"
      ? intent.customer
      : intent.customer?.id;
    if (!pmId || !customerId) {
      return new Response(JSON.stringify({ error: "Missing payment method or customer" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pm = await stripe.paymentMethods.retrieve(pmId);
    // Set as default for future off-session charges
    try {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: pmId },
      });
    } catch (e) {
      console.warn("customer.update default PM failed", e);
    }

    const { error: upErr } = await admin
      .from("bidder_verifications")
      .upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_payment_method_id: pmId,
        payment_method_brand: pm.card?.brand ?? null,
        payment_method_last4: pm.card?.last4 ?? null,
        payment_method_verified_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    if (upErr) throw upErr;

    // Auto-progress bidder status now that a card is on file.
    await admin.rpc("bidder_mark_payment_method_added", { _user_id: userId });

    return new Response(JSON.stringify({
      ok: true,
      brand: pm.card?.brand ?? null,
      last4: pm.card?.last4 ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (err) {
    console.error("confirm-bidder-payment-method error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
