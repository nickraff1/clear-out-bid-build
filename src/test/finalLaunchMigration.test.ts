import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../..");

function readMigration(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("final launch migration", () => {
  it("uses only valid order_status enum values when seeding paid-order conversations", () => {
    const baseMigration = readMigration(
      "supabase/migrations/20260203003210_f41c2087-b84c-4f8d-b9e2-84db72cdf0aa.sql",
    );
    const finalLaunchMigration = readMigration(
      "supabase/migrations/20260628010000_final_launch_admin_messaging_control.sql",
    );

    const enumMatch = baseMigration.match(/CREATE TYPE public\.order_status AS ENUM \(([^)]+)\);/);
    expect(enumMatch).not.toBeNull();

    const validStatuses = new Set(
      enumMatch![1]
        .split(",")
        .map((status) => status.trim().replaceAll("'", "")),
    );

    const seedStatusMatch = finalLaunchMigration.match(
      /o\.status IN \(([^)]+)\)\s*\)\s*INTO should_seed_order_message;/,
    );
    expect(seedStatusMatch).not.toBeNull();

    const seedStatuses = seedStatusMatch![1]
      .split(",")
      .map((status) => status.trim().replaceAll("'", ""));

    expect(seedStatuses).toEqual(["paid", "ready_for_pickup", "collected"]);
    expect(seedStatuses.every((status) => validStatuses.has(status))).toBe(true);
  });

  it("repairs missing order-confirmed system messages even when a conversation already has chat history", () => {
    const finalLaunchMigration = readMigration(
      "supabase/migrations/20260628010000_final_launch_admin_messaging_control.sql",
    );

    expect(finalLaunchMigration).toContain("m.is_system = true");
    expect(finalLaunchMigration).toContain(
      "m.body = 'Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed.'",
    );
    expect(finalLaunchMigration).not.toContain(
      "WHERE m.conversation_id = resolved_conversation_id\n      )",
    );
  });

  it("flags paid order conversations that are missing the order-confirmed system message", () => {
    const finalLaunchMigration = readMigration(
      "supabase/migrations/20260628010000_final_launch_admin_messaging_control.sql",
    );

    expect(finalLaunchMigration).toContain("has_order_confirmed_message");
    expect(finalLaunchMigration).toContain("paid_order_missing_system_message");
    expect(finalLaunchMigration).toContain("o.status IN ('paid', 'ready_for_pickup', 'collected')");
    expect(finalLaunchMigration).toContain(
      "m.body = 'Order confirmed. Please arrange pickup through this chat. Pickup details are available on the order page once payment is confirmed.'",
    );
  });
});

describe("payment webhook messaging", () => {
  it("creates order conversations idempotently and keeps pickup address out of chat", () => {
    const webhook = readMigration("supabase/functions/payments-webhook/index.ts");
    const paidOrderHelper = readMigration("supabase/functions/_shared/paid-order.ts");

    expect(webhook).toContain("ORDER_CONFIRMED_MESSAGE");
    expect(webhook).toContain("completePaidOrder");
    expect(paidOrderHelper).toContain('onConflict: "order_id"');
    expect(paidOrderHelper).toContain(".upsert(");
    expect(paidOrderHelper).toContain('.eq("body", ORDER_CONFIRMED_MESSAGE)');
    expect(paidOrderHelper).toContain("Pickup details are available on the order page once payment is confirmed.");
    expect(paidOrderHelper).not.toContain("exact pickup address");
  });

  it("repairs paid orders with order-scoped conversations", () => {
    const migration = readMigration(
      "supabase/migrations/20260701030000_repair_paid_order_conversations.sql",
    );

    expect(migration).toContain("idx_conversations_order_id_unique");
    expect(migration).toContain("DROP CONSTRAINT IF EXISTS conversations_buyer_id_seller_org_id_lot_id_key");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.ensure_conversation");
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(migration).toContain("CREATE OR REPLACE VIEW public.admin_messaging_integrity");
    expect(migration).toContain("missing_paid_order_conversations");
    expect(migration).toContain("ON CONFLICT (order_id) DO UPDATE");
    expect(migration).toContain("paid_order_missing_system_message");
  });

  it("records Stripe webhook events for idempotent processing", () => {
    const migration = readMigration(
      "supabase/migrations/20260701010000_payment_launch_hardening.sql",
    );
    const webhook = readMigration("supabase/functions/payments-webhook/index.ts");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.stripe_webhook_events");
    expect(migration).toContain("event_id text PRIMARY KEY");
    expect(webhook).toContain('sb.from("stripe_webhook_events").insert');
    expect(webhook).toContain('ledgerInsertError.code === "23505"');
    expect(webhook).toContain("Duplicate webhook event ignored");
  });

  it("hard-requires bidder cards and blocks accidental live winner charges", () => {
    const migration = readMigration(
      "supabase/migrations/20260701010000_payment_launch_hardening.sql",
    );
    const auctionCharge = readMigration("supabase/functions/_shared/auction-winner-charge.ts");
    const stripeHelper = readMigration("supabase/functions/_shared/stripe.ts");
    const createCheckout = readMigration("supabase/functions/create-checkout/index.ts");
    const setupIntent = readMigration("supabase/functions/create-bidder-setup-intent/index.ts");
    const depositHold = readMigration("supabase/functions/authorize-bid-deposit/index.ts");

    expect(migration).toContain("v.stripe_customer_id IS NULL OR v.stripe_payment_method_id IS NULL");
    expect(migration).toContain("RETURN QUERY SELECT false,'payment_method_required'");
    expect(stripeHelper).toContain('ENABLE_LIVE_PAYMENTS") !== "true"');
    expect(stripeHelper).toContain("resolveConfiguredPaymentEnvironment");
    expect(createCheckout).toContain("normalizeRequestedEnvironment(environment)");
    expect(setupIntent).toContain("resolveConfiguredPaymentEnvironment(admin)");
    expect(depositHold).toContain("resolveConfiguredPaymentEnvironment(admin)");
    expect(setupIntent).not.toContain('Deno.env.get("STRIPE_LIVE_API_KEY") ? "live" : "sandbox"');
    expect(depositHold).not.toContain('Deno.env.get("STRIPE_LIVE_API_KEY") ? "live" : "sandbox"');
    expect(auctionCharge).toContain("chargeAuctionWinnerOrder");
    expect(auctionCharge).toContain("off_session: true");
  });
});

describe("message thread recovery UX", () => {
  it("guides users when a conversation cannot be loaded", () => {
    const thread = readMigration("src/pages/app/messages/MessageThread.tsx");

    expect(thread).toContain("Conversation unavailable");
    expect(thread).toContain("order conversation repair");
    expect(thread).toContain("Check launch diagnostics");
    expect(thread).toContain("Back to messages");
  });
});

describe("admin bootstrap safety", () => {
  it("keeps founder admin bootstrap token-protected and allowlisted", () => {
    const bootstrap = readMigration("supabase/functions/bootstrap-founder-admin/index.ts");
    const docs = readMigration("docs/admin-access.md");
    const migration = readMigration(
      "supabase/migrations/20260701020000_bootstrap_founder_admin_roles.sql",
    );

    expect(bootstrap).toContain('requiredEnv("ADMIN_BOOTSTRAP_TOKEN")');
    expect(bootstrap).toContain('requiredEnv("FOUNDER_ADMIN_EMAILS")');
    expect(bootstrap).toContain("Email is not in FOUNDER_ADMIN_EMAILS");
    expect(bootstrap).toContain('role: "admin"');
    expect(bootstrap).toContain("founder_admin_bootstrap");
    expect(docs).toContain("Disable or rotate `ADMIN_BOOTSTRAP_TOKEN`");
    expect(docs).toContain("No user can self-grant admin from the frontend.");
    expect(migration).toContain("nickraffmgmt@gmail.com");
    expect(migration).toContain("anthony.younes24@gmail.com");
    expect(migration).toContain("on conflict (user_id, role) do nothing");
    expect(migration).not.toContain("select id, 'admin'::public.app_role from public.profiles");
  });
});
