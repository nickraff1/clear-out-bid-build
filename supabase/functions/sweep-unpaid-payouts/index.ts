// Scheduled sweep (every 15 min via pg_cron): retry seller transfers for
// collected orders that didn't get transferred by the pg_net trigger.
import { createClient } from "npm:@supabase/supabase-js@2";
import { isAutoPayoutsEnabled, transferSellerPayout } from "../_shared/seller-transfer.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (_req) => {
  const results: Array<{ payment_id: string; outcome: unknown }> = [];
  try {
    if (!(await isAutoPayoutsEnabled(admin))) {
      return new Response(JSON.stringify({ ok: true, skipped: "auto_payouts_disabled" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: payments } = await admin
      .from("payments")
      .select("id, order:orders!payments_order_id_fkey(status)")
      .eq("status", "succeeded")
      .is("stripe_transfer_id", null)
      .limit(50);

    const rows = (payments ?? []) as unknown as Array<{
      id: string;
      order: { status: string } | null;
    }>;

    for (const row of rows) {
      if (row.order?.status !== "collected") continue;
      try {
        const outcome = await transferSellerPayout(admin, row.id, "Auto payout sweep");
        results.push({ payment_id: row.id, outcome });
      } catch (e) {
        results.push({ payment_id: row.id, outcome: { ok: false, error: (e as Error).message } });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sweep-unpaid-payouts error", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, results }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
