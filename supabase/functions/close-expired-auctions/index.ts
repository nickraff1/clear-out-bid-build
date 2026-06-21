// Scheduled & manual auction closer. Calls the close_all_expired_auctions()
// SQL helper which atomically closes every active auction past its end time.
// Public (no auth) so pg_cron + admins can both invoke it.
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const summary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.result] = (acc[r.result] ?? 0) + 1;
      return acc;
    }, {});
    console.log("[close-expired-auctions]", { count: results.length, summary });
    return new Response(JSON.stringify({ closed: results.length, summary, results }), {
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