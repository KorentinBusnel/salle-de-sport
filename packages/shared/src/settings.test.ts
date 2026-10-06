import { describe, expect, it } from "vitest";
import { gymSettingsSchema } from "./booking.ts";
import {
  BOOLEAN_SETTINGS,
  DEFAULT_GYM_PRIVATE_SETTINGS,
  gymPrivateSettingsSchema,
  homeBlocksFor,
  navBadgesFor,
  openingHoursSchema,
  openingIntervals,
  openingSpan,
  parseGymPrivateSettings,
  parseOpeningHours,
  SETTINGS_META,
  settingValueSchema,
  weekdayOfDateKey,
} from "./settings.ts";

describe("réglages internes", () => {
  it("défauts identiques à ceux des fonctions SQL", () => {
    expect(DEFAULT_GYM_PRIVATE_SETTINGS).toMatchObject({
      desk_margin_minutes: 30,
      desk_min_gap_minutes: 15,
      desk_default_start: "09:00",
      desk_default_end: "12:00",
      trial_followup_days: 7,
      risk_window_days: 30,
      risk_min_sessions: 2,
      credit_adjust_max: 50,
      crm_list_limit: 50,
      low_fill_percent: 50,
    });
  });

  it("valeur invalide remplacée par son défaut, les autres gardées", () => {
    const settings = parseGymPrivateSettings({ trial_followup_days: 999, low_fill_percent: 40 });
    expect(settings.trial_followup_days).toBe(7);
    expect(settings.low_fill_percent).toBe(40);
    expect(parseGymPrivateSettings(null)).toEqual(DEFAULT_GYM_PRIVATE_SETTINGS);
  });
});

describe("accueil et pastilles par rôle", () => {
  const settings = parseGymPrivateSettings({
    home_blocks: { manager: ["finance", "operations"], staff: ["clients", "finance"] },
    nav_badges: { manager: ["unpaid"], staff: ["unanswered"] },
  });

  it("ordre réglé, blocs non permis au rôle ignorés, défaut sans réglage", () => {
    expect(homeBlocksFor("manager", settings)).toEqual(["finance", "operations"]);
    expect(homeBlocksFor("admin", settings)).toEqual(["finance", "operations"]);
    expect(homeBlocksFor("staff", settings)).toEqual(["clients", "finance"]);
    expect(homeBlocksFor("coach", settings)).toEqual(["operations"]);
  });

  it("pastilles permises au rôle seulement", () => {
    expect(navBadgesFor("manager", settings)).toEqual(["unpaid"]);
    expect(navBadgesFor("staff", settings)).toEqual([]);
    expect(navBadgesFor("staff", DEFAULT_GYM_PRIVATE_SETTINGS)).toEqual(["prospects"]);
    expect(navBadgesFor("manager", DEFAULT_GYM_PRIVATE_SETTINGS)).toEqual([
      "prospects",
      "unanswered",
    ]);
  });
});

describe("horaires d'ouverture", () => {
  it("refuse une fin avant le début et les chevauchements", () => {
    expect(openingHoursSchema.safeParse({ "1": [{ start: "09:00", end: "08:00" }] }).success).toBe(
      false,
    );
    expect(
      openingHoursSchema.safeParse({
        "1": [
          { start: "07:00", end: "13:00" },
          { start: "12:00", end: "21:00" },
        ],
      }).success,
    ).toBe(false);
    expect(
      openingHoursSchema.safeParse({
        "1": [
          { start: "07:00", end: "13:00" },
          { start: "16:00", end: "21:00" },
        ],
      }).success,
    ).toBe(true);
    expect(parseOpeningHours("n'importe quoi")).toEqual({});
  });

  it("jour ISO d'une date civile", () => {
    expect(weekdayOfDateKey("2026-10-05")).toBe("1");
    expect(weekdayOfDateKey("2026-10-11")).toBe("7");
  });

  it("plages d'un jour en instants, y compris le jour du passage à l'heure d'hiver", () => {
    const hours = parseOpeningHours({ "7": [{ start: "08:00", end: "20:00" }] });
    // Dimanche 25 octobre 2026 : journée de 25 h à Paris.
    const [slot] = openingIntervals(hours, "2026-10-25", "Europe/Paris");
    expect(slot?.start.toISOString()).toBe("2026-10-25T07:00:00.000Z");
    expect(slot?.end.toISOString()).toBe("2026-10-25T19:00:00.000Z");
    expect(openingIntervals(hours, "2026-10-26", "Europe/Paris")).toEqual([]);
  });

  it("amplitude de la semaine pour la grille", () => {
    expect(
      openingSpan({
        "1": [{ start: "07:30", end: "13:00" }],
        "6": [{ start: "09:00", end: "22:00" }],
      }),
    ).toEqual({ first: 450, last: 1320 });
    expect(openingSpan({})).toBeNull();
  });
});

describe("métadonnées des réglages", () => {
  it("bornes et défauts tirés des schémas", () => {
    const late = SETTINGS_META.find((m) => m.key === "late_booking_minutes");
    expect(late).toMatchObject({
      min: 0,
      max: 60,
      defaultValue: 0,
      nullable: false,
      integer: true,
    });
    const opens = SETTINGS_META.find((m) => m.key === "attendance_opens_minutes_before");
    expect(opens).toMatchObject({ nullable: true, defaultValue: null, max: 1440 });
    const hours = SETTINGS_META.find((m) => m.key === "cancellation_recommended_hours");
    expect(hours?.integer).toBe(false);
  });

  it("chaque réglage chiffré décrit une fois ; validation par ses bornes", () => {
    const keys = SETTINGS_META.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    const numericPublic = Object.keys(gymSettingsSchema.shape).filter(
      (key) => !(BOOLEAN_SETTINGS as readonly string[]).includes(key),
    );
    const numericPrivate = Object.keys(gymPrivateSettingsSchema.shape).filter(
      (key) =>
        !["desk_default_start", "desk_default_end", "home_blocks", "nav_badges"].includes(key),
    );
    expect(keys.sort()).toEqual([...numericPublic, ...numericPrivate].sort());
    const meta = SETTINGS_META.find((m) => m.key === "low_fill_percent");
    if (!meta) throw new Error("absent");
    expect(settingValueSchema(meta).safeParse(101).success).toBe(false);
    expect(settingValueSchema(meta).safeParse(40).success).toBe(true);
    expect(settingValueSchema(meta).safeParse(null).success).toBe(false);
  });
});
