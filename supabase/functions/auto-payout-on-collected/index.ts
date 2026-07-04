// Triggered from a Postgres trigger when an order transitions to `collected`.
// Runs the shared transferSellerPayout helper. Any pre-flight failure (seller
// not onboarded, open issue, feature flag off) is logged and returned as a
// non-error 200 so the pg_net call doesn't retry — the sweep cron handles retries.
import { createClient } from "npm:@supabase/supabase-js@2";
import { isAutoPayoutsEnabled, transferSellerPayout } from "../_shared/seller-transfer.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = body?.order_id as string | undefined;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    if (!(await isAutoPayoutsEnabled(admin))) {
      return new Response(JSON.stringify({ ok: false, skipped: "auto_payouts_disabled" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const { data: payment } = await admin
      .from("payments")
      .select("id, stripe_transfer_id")
      .eq("order_id", orderId)
      .eq("status", "succeeded")
      .maybeSingle();
    if (!payment) {
      return new Response(JSON.stringify({ ok: false, skipped: "no_succeeded_payment" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    const paymentRow = payment as { id: string; stripe_transfer_id: string | null };
    if (paymentRow.stripe_transfer_id) {
      return new Response(JSON.stringify({ ok: true, skipped: "already_transferred" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const outcome = await transferSellerPayout(admin, paymentRow.id, "Auto payout on collected");
    // Non-error 200 in all paths — sweep cron retries anything unresolved.
    return new Response(JSON.stringify(outcome), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-payout-on-collected error", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
});
