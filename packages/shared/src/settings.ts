import { z } from "zod";
import { gymSettingsSchema } from "./booking.ts";
import { zonedInstant } from "./dates.ts";
import { clockToMinutes } from "./desk.ts";
import type { GymRole } from "./roles.ts";

/*
 * Configuration de la salle par le gérant (BRIEF §12, 2026-10-05) : réglages internes
 * (gym_private_settings, lisibles par l'équipe seulement), horaires d'ouverture (gyms),
 * composition de l'accueil et des pastilles par rôle.
 */

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Blocs de l'accueil, et ceux qu'un rôle peut afficher (dans l'ordre par défaut). */
export const HOME_BLOCKS = ["brief", "operations", "clients", "finance"] as const;
export type HomeBlock = (typeof HOME_BLOCKS)[number];

/** Pastilles de la barre latérale (fonction SQL nav_counts). */
export const NAV_BADGES = ["prospects", "unanswered", "trials_to_call", "unpaid"] as const;
export type NavBadge = (typeof NAV_BADGES)[number];

/** Rôles dont le gérant compose l'accueil (un admin voit celui du gérant). */
export const LAYOUT_ROLES = ["manager", "staff", "coach"] as const;
export type LayoutRole = (typeof LAYOUT_ROLES)[number];

export const HOME_BLOCKS_BY_ROLE: Record<LayoutRole, readonly HomeBlock[]> = {
  manager: ["brief", "operations", "clients", "finance"],
  staff: ["operations", "clients"],
  coach: ["operations"],
};
/** Pastilles qu'un rôle peut voir (les autres comptes lui sont refusés par nav_counts). */
export const NAV_BADGES_BY_ROLE: Record<LayoutRole, readonly NavBadge[]> = {
  manager: ["prospects", "unanswered", "trials_to_call", "unpaid"],
  staff: ["prospects"],
  coach: [],
};
export const DEFAULT_NAV_BADGES: Record<LayoutRole, readonly NavBadge[]> = {
  manager: ["prospects", "unanswered"],
  staff: ["prospects"],
  coach: [],
};

export function layoutRole(role: GymRole): LayoutRole {
  return role === "admin" || role === "manager" ? "manager" : role === "staff" ? "staff" : "coach";
}

const perRole = <T extends string>(values: readonly [T, ...T[]]) =>
  z
    .object({
      manager: z.array(z.enum(values)).max(values.length),
      staff: z.array(z.enum(values)).max(values.length),
      coach: z.array(z.enum(values)).max(values.length),
    })
    .partial();

/**
 * Réglages internes (gym_private_settings.settings). Les défauts sont ceux que les fonctions
 * SQL appliquent (private.gym_private_int) : les modifier ici impose de les modifier là-bas.
 */
export const gymPrivateSettingsSchema = z.object({
  /** Sans horaires d'ouverture : accueil attendu N min avant la 1re séance et après la dernière. */
  desk_margin_minutes: z.number().int().min(0).max(120).default(30),
  /** Un trou de permanence plus court n'est pas signalé. */
  desk_min_gap_minutes: z.number().int().min(5).max(120).default(15),
  /** Créneau proposé pour une nouvelle permanence. */
  desk_default_start: clock.default("09:00"),
  desk_default_end: clock.default("12:00"),
  /** Prospect venu à un essai : à rappeler pendant N jours (crm_todo, nav_counts). */
  trial_followup_days: z.number().int().min(1).max(60).default(7),
  /** Adhérent « à risque » : fréquentation divisée par deux sur cette fenêtre (gym_kpis). */
  risk_window_days: z.number().int().min(7).max(120).default(30),
  /** … pour un adhérent venu au moins N fois sur la fenêtre précédente. */
  risk_min_sessions: z.number().int().min(1).max(20).default(2),
  /** Ajout ou retrait de crédits : N au plus par opération (adjust_credits). */
  credit_adjust_max: z.number().int().min(1).max(500).default(50),
  /** Fiches listées par catégorie du CRM à compléter (crm_todo). */
  crm_list_limit: z.number().int().min(10).max(200).default(50),
  /** Séance « peu remplie » sous ce taux de remplissage (étiquette seule, sans action). */
  low_fill_percent: z.number().int().min(0).max(100).default(50),
  /** Blocs de l'accueil par rôle, dans l'ordre (absent : tous, ordre par défaut). */
  home_blocks: perRole(HOME_BLOCKS).default({}),
  /** Pastilles de la barre latérale par rôle (absent : DEFAULT_NAV_BADGES). */
  nav_badges: perRole(NAV_BADGES).default({}),
});

export type GymPrivateSettings = z.infer<typeof gymPrivateSettingsSchema>;
export const DEFAULT_GYM_PRIVATE_SETTINGS: GymPrivateSettings = gymPrivateSettingsSchema.parse({});

/** Lit gym_private_settings.settings, chaque valeur absente ou invalide remplacée par son défaut. */
export function parseGymPrivateSettings(raw: unknown): GymPrivateSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const settings = { ...DEFAULT_GYM_PRIVATE_SETTINGS };
  for (const key of Object.keys(gymPrivateSettingsSchema.shape) as (keyof GymPrivateSettings)[]) {
    const parsed = gymPrivateSettingsSchema.shape[key].safeParse(source[key]);
    if (parsed.success) Object.assign(settings, { [key]: parsed.data });
  }
  return settings;
}

/** Blocs affichés pour un rôle : ceux qu'il peut voir, dans l'ordre réglé par le gérant. */
export function homeBlocksFor(role: GymRole, settings: GymPrivateSettings): HomeBlock[] {
  const key = layoutRole(role);
  const allowed = HOME_BLOCKS_BY_ROLE[key];
  const chosen = settings.home_blocks[key];
  if (!chosen) return [...allowed];
  return [...new Set(chosen)].filter((block) => allowed.includes(block));
}

/** Pastilles affichées pour un rôle. */
export function navBadgesFor(role: GymRole, settings: GymPrivateSettings): NavBadge[] {
  const key = layoutRole(role);
  const allowed = NAV_BADGES_BY_ROLE[key];
  const chosen = settings.nav_badges[key] ?? DEFAULT_NAV_BADGES[key];
  return [...new Set(chosen)].filter((badge) => allowed.includes(badge));
}

// ---------------------------------------------------------------------------
// Horaires d'ouverture (gyms.opening_hours)
// ---------------------------------------------------------------------------

export const WEEKDAY_KEYS = ["1", "2", "3", "4", "5", "6", "7"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

const slotSchema = z
  .object({ start: clock, end: clock })
  .refine((slot) => clockToMinutes(slot.end) > clockToMinutes(slot.start), {
    message: "end_before_start",
    path: ["end"],
  });
export type OpeningSlot = z.infer<typeof slotSchema>;

/** Plages par jour ISO (« 1 » = lundi), triées, sans chevauchement, trois au plus par jour. */
export const openingHoursSchema = z
  .partialRecord(z.enum(WEEKDAY_KEYS), z.array(slotSchema).max(3))
  .superRefine((hours, ctx) => {
    for (const day of WEEKDAY_KEYS) {
      const slots = hours[day] ?? [];
      for (let i = 1; i < slots.length; i++) {
        const previous = slots[i - 1];
        const slot = slots[i];
        if (previous && slot && clockToMinutes(slot.start) < clockToMinutes(previous.end)) {
          ctx.addIssue({ code: "custom", message: "overlap", path: [day, i, "start"] });
        }
      }
    }
  });
export type OpeningHours = z.infer<typeof openingHoursSchema>;

/** Lit gyms.opening_hours (invalide : aucun horaire). */
export function parseOpeningHours(raw: unknown): OpeningHours {
  const parsed = openingHoursSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

export function hasOpeningHours(hours: OpeningHours): boolean {
  return WEEKDAY_KEYS.some((day) => (hours[day]?.length ?? 0) > 0);
}

/** Jour ISO (« 1 » = lundi) d'une date civile « AAAA-MM-JJ ». */
export function weekdayOfDateKey(dateKey: string): WeekdayKey {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = ((new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay() + 6) %
    7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  return WEEKDAY_KEYS[weekday];
}

/** Plages d'ouverture d'une date, en instants (fuseau de la salle, changements d'heure gérés). */
export function openingIntervals(
  hours: OpeningHours,
  dateKey: string,
  timeZone: string,
): { start: Date; end: Date }[] {
  return (hours[weekdayOfDateKey(dateKey)] ?? []).map((slot) => ({
    start: zonedInstant(dateKey, clockToMinutes(slot.start), timeZone),
    end: zonedInstant(dateKey, clockToMinutes(slot.end), timeZone),
  }));
}

/** Première ouverture et dernière fermeture de la semaine, en minutes (grille du planning). */
export function openingSpan(hours: OpeningHours): { first: number; last: number } | null {
  const slots = WEEKDAY_KEYS.flatMap((day) => hours[day] ?? []);
  if (!slots.length) return null;
  return {
    first: Math.min(...slots.map((slot) => clockToMinutes(slot.start))),
    last: Math.max(...slots.map((slot) => clockToMinutes(slot.end))),
  };
}

// ---------------------------------------------------------------------------
// Métadonnées des réglages chiffrés (écran Paramètres)
// ---------------------------------------------------------------------------

export type SettingSection = "reservations" | "strategies" | "accueil" | "suivi";
export type SettingUnit =
  "minutes" | "hours" | "days" | "percent" | "credits" | "sessions" | "rows";

export type NumberSettingMeta = {
  key: string;
  scope: "public" | "private";
  section: SettingSection;
  unit: SettingUnit;
  /** Valeur vide autorisée (null : sans limite). */
  nullable: boolean;
  /** Entier seulement (sinon décimal, au pas `step`). */
  integer: boolean;
  min: number;
  max: number;
  step: number;
  defaultValue: number | null;
};

type Bounded = { minValue: number | null; maxValue: number | null; isInt: boolean };

/** Bornes d'un nombre Zod (sous .default() et .nullable()). */
function numberBounds(schema: z.ZodType): Bounded {
  let current: unknown = schema;
  for (let depth = 0; depth < 4; depth++) {
    if (current instanceof z.ZodNumber) return current;
    if (current instanceof z.ZodDefault || current instanceof z.ZodNullable) {
      current = current.unwrap();
      continue;
    }
    break;
  }
  throw new Error("réglage non numérique");
}

const NUMBER_SETTINGS: {
  key: string;
  scope: "public" | "private";
  section: SettingSection;
  unit: SettingUnit;
  step?: number;
}[] = [
  { key: "max_upcoming_bookings", scope: "public", section: "reservations", unit: "sessions" },
  {
    key: "cancellation_recommended_hours",
    scope: "public",
    section: "reservations",
    unit: "hours",
  },
  { key: "credit_adjust_max", scope: "private", section: "reservations", unit: "credits" },
  { key: "late_booking_minutes", scope: "public", section: "strategies", unit: "minutes", step: 5 },
  {
    key: "attendance_opens_minutes_before",
    scope: "public",
    section: "strategies",
    unit: "minutes",
    step: 5,
  },
  { key: "desk_margin_minutes", scope: "private", section: "accueil", unit: "minutes", step: 5 },
  { key: "desk_min_gap_minutes", scope: "private", section: "accueil", unit: "minutes", step: 5 },
  { key: "trial_followup_days", scope: "private", section: "suivi", unit: "days" },
  { key: "risk_window_days", scope: "private", section: "suivi", unit: "days" },
  { key: "risk_min_sessions", scope: "private", section: "suivi", unit: "sessions" },
  { key: "low_fill_percent", scope: "private", section: "suivi", unit: "percent", step: 5 },
  { key: "crm_list_limit", scope: "private", section: "suivi", unit: "rows", step: 10 },
];

/**
 * Réglages chiffrés de l'écran Paramètres : bornes et défauts tirés des schémas Zod (une seule
 * source), section et unité pour l'affichage.
 */
export const SETTINGS_META: NumberSettingMeta[] = NUMBER_SETTINGS.map((entry) => {
  const shape: Record<string, z.ZodType> =
    entry.scope === "public" ? gymSettingsSchema.shape : gymPrivateSettingsSchema.shape;
  const schema = shape[entry.key];
  if (!schema) throw new Error(`réglage inconnu : ${entry.key}`);
  const bounds = numberBounds(schema);
  const parsedDefault = schema.parse(undefined) as number | null;
  return {
    ...entry,
    nullable: schema.safeParse(null).success,
    integer: bounds.isInt,
    min: bounds.minValue ?? 0,
    max: bounds.maxValue ?? Number.MAX_SAFE_INTEGER,
    step: entry.step ?? 1,
    defaultValue: parsedDefault,
  };
});

/** Réglages booléens (stratégies), désactivés par défaut. */
export const BOOLEAN_SETTINGS = [
  "allow_attendance_reset",
  "manager_can_remove_credits",
  "staff_can_suspend_members",
  "staff_can_create_members",
] as const satisfies readonly (keyof typeof gymSettingsSchema.shape)[];
export type BooleanSetting = (typeof BOOLEAN_SETTINGS)[number];

/** Valeur saisie pour un réglage chiffré : validée par son schéma (null si vide et permis). */
export function settingValueSchema(meta: NumberSettingMeta) {
  const number = z.number().min(meta.min).max(meta.max);
  const base = meta.integer ? number.int() : number;
  return meta.nullable ? base.nullable() : base;
}
