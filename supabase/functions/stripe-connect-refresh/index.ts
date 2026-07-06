// Refreshes a seller's Stripe Connect account status from Stripe and updates
// seller_stripe_accounts so the UI reflects onboarding completion without
// requiring a webhook round-trip.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, resolveConfiguredPaymentEnvironment, type StripeEnv } from "../_shared/stripe.ts";
import { summarizeConnectAccount } from "../_shared/connect-status.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function updateAccountStatus(orgId: string, account: any, env: StripeEnv) {
  const summary = summarizeConnectAccount(account);
  const { error } = await admin.from("seller_stripe_accounts").update({
    ...summary,
    stripe_environment: env,
  }).eq("org_id", orgId);
  if (!error) return summary;

  console.warn("Rich seller_stripe_accounts update failed, falling back to legacy columns", error.message);
  const { error: fallbackError } = await admin.from("seller_stripe_accounts").update({
    charges_enabled: summary.charges_enabled,
    payouts_enabled: summary.payouts_enabled,
    details_submitted: summary.details_submitted,
    onboarding_complete: summary.onboarding_complete,
    account_status: summary.account_status,
    updated_at: new Date().toISOString(),
  }).eq("org_id", orgId);
  if (fallbackError) throw fallbackError;
  return summary;
}

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

    const body = await req.json().catch(() => ({}));
    const orgId = body?.org_id as string | undefined;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "org_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isMember } = await admin.rpc("is_org_member", { _user_id: user.id, _org_id: orgId });
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: user.id });
    if (!isMember && !isAdmin) {
      return new Response(JSON.stringify({ error: "Not a member of this organisation" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await admin
      .from("seller_stripe_accounts")
      .select("stripe_account_id")
      .eq("org_id", orgId)
      .maybeSingle();

    const accountId = (existing as { stripe_account_id: string | null } | null)?.stripe_account_id;
    if (!accountId) {
      return new Response(JSON.stringify({ refreshed: false, reason: "no_account" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env: StripeEnv = await resolveConfiguredPaymentEnvironment(admin);
    const stripe = createStripeClient(env);

    let account;
    try {
      account = await stripe.accounts.retrieve(accountId);
    } catch (e) {
      console.warn("Could not retrieve stripe account in current env", {
        accountId, env, error: (e as Error).message,
      });
      return new Response(JSON.stringify({ refreshed: false, reason: "not_found_in_env" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary = await updateAccountStatus(orgId, account, env);

    return new Response(JSON.stringify({
      refreshed: true,
      ...summary,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("stripe-connect-refresh error", e);
    return new Response(JSON.stringify({ error: (e as Error).message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
