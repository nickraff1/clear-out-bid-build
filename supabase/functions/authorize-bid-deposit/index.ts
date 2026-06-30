import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createStripeClient, resolveConfiguredPaymentEnvironment } from "../_shared/stripe.ts";

// Creates (or reuses) a manual-capture PaymentIntent that authorizes the
// required deposit on the bidder's saved card for a given lot.
// Records an `auction_deposits` row with status `authorized`,
// `requires_action`, `failed`, or `scaffolded_unsupported`.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const lotId = body?.lot_id as string | undefined;
    if (!lotId) {
      return new Response(JSON.stringify({ error: "lot_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Re-check eligibility / required deposit server-side.
    const { data: elig, error: eligErr } = await admin
      .rpc("can_user_bid", { _user_id: userId, _lot_id: lotId })
      .maybeSingle();
    if (eligErr) throw eligErr;

    const required = Number(elig?.required_deposit ?? 0);
    if (!elig || elig.reason === "lot_not_found" || elig.reason === "auction_ended"
      || elig.reason === "auction_not_active" || elig.reason === "account_banned"
      || elig.reason === "account_restricted") {
      return new Response(JSON.stringify({
        error: "Deposit cannot be authorized: " + (elig?.reason ?? "ineligible"),
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (required <= 0) {
      return new Response(JSON.stringify({
        ok: true, skipped: true, message: "No deposit required at this tier.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const { data: lot } = await admin.from("lots")
      .select("id, title, current_bid, start_price").eq("id", lotId).single();
    const currentPrice = Number(lot?.current_bid ?? lot?.start_price ?? 0);

    const { data: bv } = await admin
      .from("bidder_verifications")
      .select("stripe_customer_id, stripe_payment_method_id")
      .eq("user_id", userId).maybeSingle();
    if (!bv?.stripe_customer_id || !bv?.stripe_payment_method_id) {
      return new Response(JSON.stringify({ error: "payment_method_required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await admin
      .from("auction_deposit_settings").select("current_gateway_mode").eq("singleton", true).maybeSingle();
    const gatewayMode = (settings?.current_gateway_mode as string) ?? "lovable_gateway_sandbox";
    const env = await resolveConfiguredPaymentEnvironment(admin);

    // Reuse an existing authorized hold that already covers the required amount.
    const { data: existing } = await admin
      .from("auction_deposits")
      .select("id, amount, status")
      .eq("user_id", userId).eq("lot_id", lotId).eq("purpose", "bid_hold")
      .in("status", ["authorized", "charged", "applied_to_order"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing && Number(existing.amount) >= required) {
      return new Response(JSON.stringify({
        ok: true, deposit_id: existing.id, amount: Number(existing.amount), reused: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const stripe = createStripeClient(env);

    const { data: depRow, error: insErr } = await admin.from("auction_deposits").insert({
      user_id: userId, lot_id: lotId, amount: required,
      purpose: "bid_hold",
      tier_band: null,
      gateway_mode: gatewayMode,
      status: "required",
      payment_method_id: bv.stripe_payment_method_id,
    }).select("id").single();
    if (insErr) throw insErr;

    try {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(required * 100),
        currency: "aud",
        capture_method: "manual",
        customer: bv.stripe_customer_id,
        payment_method: bv.stripe_payment_method_id,
        confirm: true,
        off_session: true,
        description: `Bid commitment hold for ${lot?.title ?? "lot"}`,
        metadata: {
          user_id: userId, lot_id: lotId, deposit_id: depRow.id,
          purpose: "bid_hold", current_price: String(currentPrice),
        },
      });

      let status: string = "failed";
      if (intent.status === "requires_capture" || intent.status === "succeeded") status = "authorized";
      else if (intent.status === "requires_action") status = "required";
      else if (intent.status === "requires_payment_method") status = "failed";

      await admin.from("auction_deposits").update({
        stripe_payment_intent_id: intent.id,
        status,
        failure_reason: status === "failed"
          ? `Stripe status: ${intent.status}` : null,
        updated_at: new Date().toISOString(),
      }).eq("id", depRow.id);

      return new Response(JSON.stringify({
        ok: status === "authorized",
        deposit_id: depRow.id,
        status,
        amount: required,
        intent_status: intent.status,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    } catch (stripeErr) {
      console.error("[authorize-bid-deposit] stripe failed", stripeErr);
      const msg = (stripeErr as Error)?.message ?? "unknown";
      // If the gateway sandbox does not support manual-capture for this account, mark scaffolded.
      const isUnsupported = /not.*supported|unavailable|forbidden/i.test(msg);
      await admin.from("auction_deposits").update({
        status: isUnsupported ? "scaffolded_unsupported" : "failed",
        failure_reason: msg,
        updated_at: new Date().toISOString(),
      }).eq("id", depRow.id);
      return new Response(JSON.stringify({
        ok: false,
        deposit_id: depRow.id,
        status: isUnsupported ? "scaffolded_unsupported" : "failed",
        error: msg,
        scaffolded: isUnsupported,
      }), {
        status: isUnsupported ? 200 : 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("authorize-bid-deposit error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
