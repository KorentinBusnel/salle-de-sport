import { readdirSync, readFileSync } from "node:fs";
import { BOOKING_ERROR_CODES, GYM_ROLES } from "@salle/shared";
import { describe, expect, it } from "vitest";
import { Constants } from "./database.types.ts";

// Les règles métier de packages/shared doivent rester alignées sur les enums Postgres.
describe("synchronisation shared ↔ schéma", () => {
  it("GYM_ROLES correspond à l'enum gym_role", () => {
    expect([...GYM_ROLES]).toEqual([...Constants.public.Enums.gym_role]);
  });
});

describe("synchronisation codes d'erreur SQL ↔ shared", () => {
  it("chaque code levé par les migrations est connu de BOOKING_ERROR_CODES", () => {
    const dir = new URL("../../../supabase/migrations/", import.meta.url);
    const raised = new Set<string>();
    for (const file of readdirSync(dir)) {
      const sql = readFileSync(new URL(file, dir), "utf8");
      for (const match of sql.matchAll(/raise exception '([a-z_]+)'/g)) raised.add(match[1] ?? "");
    }
    expect(raised.size).toBeGreaterThan(0);
    expect(
      [...raised].filter((code) => !(BOOKING_ERROR_CODES as readonly string[]).includes(code)),
    ).toEqual([]);
  });
});
