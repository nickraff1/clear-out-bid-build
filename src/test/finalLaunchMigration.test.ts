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
});
