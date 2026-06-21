// Stripe Connect Express onboarding link generator.
// TODO: Add STRIPE_SECRET_KEY in Backend → Secrets to activate.
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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

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

    const { org_id, return_url } = await req.json();

    // Look up existing account
    const { data: existing } = await supabase
      .from("seller_stripe_accounts")
      .select("*")
      .eq("org_id", org_id)
      .maybeSingle();

    const Stripe = (await import("https://esm.sh/stripe@14.21.0?target=deno")).default;
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    let accountId = existing?.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
      });
      accountId = account.id;
      await supabase.from("seller_stripe_accounts").upsert({
        org_id,
        stripe_account_id: accountId,
        account_status: "pending",
      });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: return_url,
      return_url: return_url,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: link.url, account_id: accountId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});