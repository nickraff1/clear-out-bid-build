// Scheduled & manual auction closer. Calls the close_all_expired_auctions()
// SQL helper which atomically closes every active auction past its end time.
// Public (no auth) so pg_cron + admins can both invoke it.
import { createClient } from "npm:@supabase/supabase-js@2";
import { chargeAuctionWinnerOrder } from "../_shared/auction-winner-charge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await sb.rpc("close_all_expired_auctions");
    if (error) throw error;
    const results = (data ?? []) as Array<{ lot_id: string; result: string }>;
    const chargeResults: Array<Record<string, unknown>> = [];

    for (const result of results) {
      if (result.result !== "sold") continue;
      const { data: lot } = await sb
        .from("lots")
        .select("reserved_order_id")
        .eq("id", result.lot_id)
        .maybeSingle();
      const orderId = (lot as { reserved_order_id?: string | null } | null)?.reserved_order_id;
      if (!orderId) {
        chargeResults.push({ lot_id: result.lot_id, ok: false, skipped: "missing_reserved_order" });
        continue;
      }
      const charge = await chargeAuctionWinnerOrder(sb, { orderId });
      chargeResults.push({ lot_id: result.lot_id, order_id: orderId, ...charge });
    }

    const { data: sweepData, error: sweepError } = await sb.rpc("sweep_defaulted_winners");
    if (sweepError) throw sweepError;
    const sweepResults = (sweepData ?? []) as Array<{
      order_id: string;
      result: string;
      next_order_id?: string | null;
    }>;

    for (const sweep of sweepResults) {
      if (!sweep.next_order_id) continue;
      const charge = await chargeAuctionWinnerOrder(sb, { orderId: sweep.next_order_id });
      chargeResults.push({
        source: "next_bidder_offer",
        previous_order_id: sweep.order_id,
        order_id: sweep.next_order_id,
        ...charge,
      });
    }

    const defaulted = chargeResults.filter((r) => r.ok === false).length;
    const summary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.result] = (acc[r.result] ?? 0) + 1;
      return acc;
    }, {});
    console.log("[close-expired-auctions]", { count: results.length, summary, chargeResults });
    return new Response(JSON.stringify({
      closed: results.length,
      defaulted,
      summary,
      results,
      defaulted_winner_results: sweepResults,
      charge_results: chargeResults,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("close-expired-auctions error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
