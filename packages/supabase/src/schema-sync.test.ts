import { GYM_ROLES } from "@salle/shared";
import { describe, expect, it } from "vitest";
import { Constants } from "./database.types.ts";

// Les règles métier de packages/shared doivent rester alignées sur les enums Postgres.
describe("synchronisation shared ↔ schéma", () => {
  it("GYM_ROLES correspond à l'enum gym_role", () => {
    expect([...GYM_ROLES]).toEqual([...Constants.public.Enums.gym_role]);
  });
});
