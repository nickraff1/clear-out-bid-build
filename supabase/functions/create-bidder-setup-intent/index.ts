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
    const userEmail = (claimsData.claims.email as string | undefined) ?? undefined;
    const body = await req.json().catch(() => ({}));
    const requestedEnvironment = body?.environment as string | undefined;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const env = requestedEnvironment
      ? normalizeRequestedEnvironment(requestedEnvironment)
      : await resolveConfiguredPaymentEnvironment(admin);
    const stripe = createStripeClient(env);

    const { data: savedMethod } = await admin
      .from("bidder_payment_methods")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", env)
      .maybeSingle();

    let customerId = savedMethod?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { user_id: userId, source: "offcutt_bidder" },
      });
      customerId = customer.id;
      await admin
        .from("bidder_payment_methods")
        .upsert({
          user_id: userId,
          environment: env,
          stripe_customer_id: customerId,
          is_active: true,
        }, { onConflict: "user_id,environment" });
    }

    const intent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: { user_id: userId, purpose: "bidder_card_on_file" },
    });

    return new Response(
      JSON.stringify({ client_secret: intent.client_secret, customer_id: customerId, environment: env }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("create-bidder-setup-intent error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
