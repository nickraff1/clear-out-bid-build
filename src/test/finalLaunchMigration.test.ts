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
});

describe("payment webhook messaging", () => {
  it("creates order conversations idempotently and keeps pickup address out of chat", () => {
    const webhook = readMigration("supabase/functions/payments-webhook/index.ts");

    expect(webhook).toContain('onConflict: "buyer_id,seller_org_id,lot_id"');
    expect(webhook).toContain(".upsert(");
    expect(webhook).toContain("ORDER_CONFIRMED_MESSAGE");
    expect(webhook).toContain('.eq("body", ORDER_CONFIRMED_MESSAGE)');
    expect(webhook).toContain("Pickup details are available on the order page once payment is confirmed.");
    expect(webhook).not.toContain("exact pickup address");
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
