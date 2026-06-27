// Atomically cancel a pending_payment order created by the current user.
// Triggers DB release_lot_on_order_cancel to free the lot reservation.
import { createClient } from "npm:@supabase/supabase-js@2";

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
    if (!authHeader) {
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

    const { order_id } = await req.json() as { order_id?: string };
    if (!order_id) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort: sweep expired reservations regardless.
    await admin.rpc("release_expired_reservations");

    const { data: order } = await admin.from("orders")
      .select("id, buyer_id, status").eq("id", order_id).maybeSingle();
    if (!order) {
      return new Response(JSON.stringify({ ok: true, skipped: "not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.buyer_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.status !== "pending_payment") {
      return new Response(JSON.stringify({ ok: true, skipped: order.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guard: don't cancel if a successful payment already exists.
    const { data: succeeded } = await admin.from("payments")
      .select("id").eq("order_id", order_id).eq("status", "succeeded").maybeSingle();
    if (succeeded) {
      return new Response(JSON.stringify({ ok: true, skipped: "already_paid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await admin.from("orders")
      .update({ status: "cancelled" }).eq("id", order_id);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true, cancelled: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("cancel-pending-order", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});