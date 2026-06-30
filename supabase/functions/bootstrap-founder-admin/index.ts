import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const requiredEnv = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const configuredToken = requiredEnv("ADMIN_BOOTSTRAP_TOKEN");
    const allowedEmails = requiredEnv("FOUNDER_ADMIN_EMAILS")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean);

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "");
    const email = normalizeEmail(String(body?.email ?? ""));

    if (!token || token !== configuredToken) {
      return new Response(JSON.stringify({ error: "Invalid bootstrap token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!email || !allowedEmails.includes(email)) {
      return new Response(JSON.stringify({ error: "Email is not in FOUNDER_ADMIN_EMAILS" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.id) {
      return new Response(JSON.stringify({ error: "Profile not found. Sign in once, then retry bootstrap." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: roleError } = await admin
      .from("user_roles")
      .upsert({ user_id: profile.id, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) throw roleError;

    await admin.from("admin_audit_logs").insert({
      admin_id: profile.id,
      action: "founder_admin_bootstrap",
      entity_type: "user_roles",
      entity_id: profile.id,
      details: {
        email,
        note: "Granted by token-protected bootstrap-founder-admin edge function. Disable ADMIN_BOOTSTRAP_TOKEN after verification.",
      },
    }).throwOnError();

    return new Response(JSON.stringify({
      ok: true,
      email,
      user_id: profile.id,
      role: "admin",
      next_step: "Sign out and back in, then open /app/admin/launch-checklist.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("bootstrap-founder-admin error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
