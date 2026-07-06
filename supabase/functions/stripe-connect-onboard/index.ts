// Stripe Connect Express onboarding link generator.
// Routes all Stripe API calls through the Lovable gateway proxy.
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
    const returnUrl = body?.return_url as string | undefined;
    // Always resolve environment server-side from the configured gateway mode.
    // The client's publishable key prefix (pk_test_ in preview) must NOT decide
    // whether we create a sandbox or live Connect account.
    const env: StripeEnv = await resolveConfiguredPaymentEnvironment(admin);
    if (!orgId || !returnUrl) {
      return new Response(JSON.stringify({ error: "org_id and return_url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller must be a member of the org (or an admin).
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

    const stripe = createStripeClient(env);
    let accountId = (existing as { stripe_account_id: string | null } | null)?.stripe_account_id ?? null;

    // If we have an existing account id, verify it exists in the current
    // environment. A sandbox acct_... will 404 against the live API (and vice
    // versa) — in that case, forget it and create a fresh account for this env.
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId);
      } catch (retrieveErr) {
        console.warn("Existing stripe account not found in current env, recreating", {
          accountId, env, error: (retrieveErr as Error).message,
        });
        accountId = null;
      }
    }

    if (!accountId) {
      // Load org for prefill.
      const { data: org } = await admin
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .maybeSingle();
      const orgName = (org as { name?: string | null } | null)?.name ?? undefined;

      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        email: user.email ?? undefined,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        business_profile: orgName ? { name: orgName } : undefined,
        metadata: { org_id: orgId, created_by_user_id: user.id },
      });
      accountId = account.id;

      await admin.from("seller_stripe_accounts").upsert({
        org_id: orgId,
        stripe_account_id: accountId,
        ...summarizeConnectAccount(account),
        stripe_environment: env,
      }, { onConflict: "org_id" });
    }

    // Account links are single-use — always mint a fresh one.
    const link = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: "account_onboarding",
      collection_options: {
        fields: "eventually_due",
        future_requirements: "include",
      },
    });

    await admin.from("seller_stripe_accounts").update({
      last_onboarding_link_created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("org_id", orgId);

    return new Response(JSON.stringify({ url: link.url, account_id: accountId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stripe-connect-onboard error", e);
    return new Response(JSON.stringify({ error: (e as Error).message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
