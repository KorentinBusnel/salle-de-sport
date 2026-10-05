"use server";

import {
  BOOLEAN_SETTINGS,
  HOME_BLOCKS,
  HOME_BLOCKS_BY_ROLE,
  LAYOUT_ROLES,
  NAV_BADGES,
  NAV_BADGES_BY_ROLE,
  openingHoursSchema,
  SETTINGS_META,
  settingValueSchema,
} from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Json, TablesUpdate } from "@salle/supabase";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { isManagerRole, requireRole } from "@/lib/auth";
import { errorMessageKey, withFlash } from "@/lib/flash";
import { getGymConfig } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

/*
 * Paramètres enregistrés sur place : chaque action valide par Zod, écrit (fonction SQL
 * update_gym_settings, ou colonnes d'identité de gyms sous RLS), puis rafraîchit l'écran.
 * Le client affiche un toast avec « Annuler » (il rappelle l'action avec l'ancienne valeur).
 */

async function writeSettings(
  gymId: string,
  patch: { settings?: Record<string, Json>; private?: Record<string, Json> },
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_gym_settings", {
    p_gym_id: gymId,
    p_settings: patch.settings ?? {},
    p_private: patch.private ?? {},
  });
  if (error) return fail(errorMessageKey(error));
  revalidatePath("/", "layout");
  refresh();
  return ok("settings.saved");
}

/** Réglage chiffré ou booléen (SETTINGS_META, BOOLEAN_SETTINGS). */
export async function saveSetting(input: {
  key: string;
  value: number | boolean | null;
}): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const meta = SETTINGS_META.find((entry) => entry.key === input.key);
  if (meta) {
    const value = settingValueSchema(meta).safeParse(input.value);
    if (!value.success) return fail("settings.errors.outOfRange");
    return writeSettings(context.gym.id, {
      [meta.scope === "public" ? "settings" : "private"]: { [meta.key]: value.data },
    });
  }
  const flag = z.enum(BOOLEAN_SETTINGS).safeParse(input.key);
  if (!flag.success || typeof input.value !== "boolean") return fail("settings.errors.invalid");
  return writeSettings(context.gym.id, { settings: { [flag.data]: input.value } });
}

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Créneau proposé pour une nouvelle permanence. */
export async function saveDeskSlot(input: { start: string; end: string }): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const slot = z
    .object({ start: clock, end: clock })
    .refine((value) => value.end > value.start)
    .safeParse(input);
  if (!slot.success) return fail("settings.errors.slot");
  return writeSettings(context.gym.id, {
    private: { desk_default_start: slot.data.start, desk_default_end: slot.data.end },
  });
}

/** Blocs de l'accueil d'un rôle (dans l'ordre) ou ses pastilles. */
export async function saveLayout(input: {
  role: string;
  kind: "home_blocks" | "nav_badges";
  values: string[];
}): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const role = z.enum(LAYOUT_ROLES).safeParse(input.role);
  if (!role.success) return fail("settings.errors.invalid");
  const allowed: readonly string[] =
    input.kind === "home_blocks" ? HOME_BLOCKS_BY_ROLE[role.data] : NAV_BADGES_BY_ROLE[role.data];
  const values = z
    .array(z.enum(input.kind === "home_blocks" ? HOME_BLOCKS : NAV_BADGES))
    .max(allowed.length)
    .safeParse(input.values);
  if (!values.success || values.data.some((value) => !allowed.includes(value)))
    return fail("settings.errors.invalid");
  const current = (await getGymConfig(context.gym.id)).private[input.kind];
  return writeSettings(context.gym.id, {
    private: { [input.kind]: { ...current, [role.data]: [...new Set(values.data)] } },
  });
}

const identitySchema = {
  name: z.string().trim().min(1).max(80),
  address: z
    .string()
    .trim()
    .max(200)
    .transform((value) => value || null),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s().-]*$/)
    .transform((value) => value || null),
  email: z.union([z.literal(""), z.email().max(120)]).transform((value) => value || null),
} as const;

/** Nom, adresse, téléphone ou email de la salle. */
export async function saveIdentity(input: { field: string; value: string }): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const field = z.enum(["name", "address", "phone", "email"]).safeParse(input.field);
  if (!field.success) return fail("settings.errors.invalid");
  const value = identitySchema[field.data].safeParse(input.value);
  if (!value.success) return fail(`settings.identity.errors.${field.data}`);
  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({ [field.data]: value.data } as TablesUpdate<"gyms">)
    .eq("id", context.gym.id);
  if (error) return fail("common.unexpectedError");
  revalidatePath("/", "layout");
  refresh();
  return ok("settings.saved");
}

/** Horaires d'ouverture (plages par jour). */
export async function saveOpeningHours(input: unknown): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const hours = openingHoursSchema.safeParse(input);
  if (!hours.success) return fail("settings.hours.errors.invalid");
  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({ opening_hours: hours.data as NonNullable<Json> })
    .eq("id", context.gym.id);
  if (error) return fail("common.unexpectedError");
  revalidatePath("/", "layout");
  refresh();
  return ok("settings.hours.saved");
}

const closureSchema = z.object({
  day: z.iso.date(),
  label: z.string().trim().min(1).max(80),
});

/** Jour de fermeture (alerte pour le gérant ; les cours restent possibles). */
export async function addClosure(input: { day: string; label: string }): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const closure = closureSchema.safeParse(input);
  if (!closure.success) return fail("settings.closures.errors.invalid");
  const supabase = await createClient();
  const { error } = await supabase
    .from("gym_closures")
    .insert({ gym_id: context.gym.id, ...closure.data });
  if (error)
    return fail(
      error.code === "23505" ? "settings.closures.errors.duplicate" : "common.unexpectedError",
    );
  refresh();
  return ok("settings.closures.added");
}

export async function removeClosure(input: { id: string }): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const id = z.guid().safeParse(input.id);
  if (!id.success) return fail("settings.errors.invalid");
  const supabase = await createClient();
  const { error } = await supabase
    .from("gym_closures")
    .delete()
    .eq("id", id.data)
    .eq("gym_id", context.gym.id);
  if (error) return fail("common.unexpectedError");
  refresh();
  return ok("settings.closures.removed");
}

const LOGO_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
const LOGO_MAX_BYTES = 1024 * 1024;

/** Logo téléversé dans gym-assets/<salle>/ ; l'ancien fichier est supprimé. */
export async function uploadLogo(formData: FormData): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return fail("settings.logo.errors.missing");
  const extension = LOGO_TYPES[file.type as keyof typeof LOGO_TYPES];
  if (!extension) return fail("settings.logo.errors.type");
  if (file.size > LOGO_MAX_BYTES) return fail("settings.logo.errors.size");

  const supabase = await createClient();
  const previous = (await getGymConfig(context.gym.id)).identity.logoPath;
  const path = `${context.gym.id}/logo-${Date.now()}.${extension}`;
  const upload = await supabase.storage
    .from("gym-assets")
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (upload.error) return fail("settings.logo.errors.upload");
  const { error } = await supabase
    .from("gyms")
    .update({ logo_path: path })
    .eq("id", context.gym.id);
  if (error) {
    await supabase.storage.from("gym-assets").remove([path]);
    return fail("common.unexpectedError");
  }
  if (previous) await supabase.storage.from("gym-assets").remove([previous]);
  revalidatePath("/", "layout");
  refresh();
  return ok("settings.logo.saved");
}

export async function removeLogo(): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const previous = (await getGymConfig(context.gym.id)).identity.logoPath;
  const { error } = await supabase
    .from("gyms")
    .update({ logo_path: null })
    .eq("id", context.gym.id);
  if (error) return fail("common.unexpectedError");
  if (previous) await supabase.storage.from("gym-assets").remove([previous]);
  revalidatePath("/", "layout");
  refresh();
  return ok("settings.logo.removed");
}

/** Ordre des disciplines (identifiants dans l'ordre voulu). */
export async function reorderDisciplines(input: { ids: string[] }): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const ids = z.array(z.guid()).min(1).max(200).safeParse(input.ids);
  if (!ids.success) return fail("settings.errors.invalid");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_disciplines", {
    p_gym_id: context.gym.id,
    p_ids: ids.data,
  });
  if (error) return fail(errorMessageKey(error));
  revalidatePath("/planning", "layout");
  refresh();
  return ok("catalog.reordered");
}

const TEAM = "/parametres?onglet=equipe";
const teamRole = z.enum(["coach", "staff", "manager", "admin"]);

/** Ajoute un rôle d'équipe à un compte existant (email). Seul un admin attribue admin. */
export async function addTeamRole(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim());
  const role = teamRole.safeParse(formData.get("role"));
  if (!email.success || !role.success) redirect(withFlash(TEAM, { error: "team.errors.invalid" }));
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_team_role", {
    p_gym_id: context.gym.id,
    p_email: email.data,
    p_role: role.data,
  });
  revalidatePath("/parametres");
  redirect(withFlash(TEAM, error ? { error: errorMessageKey(error) } : { ok: "team.added" }));
}

export async function removeTeamRole(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const profileId = z.guid().parse(formData.get("profileId"));
  const role = teamRole.parse(formData.get("role"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_team_role", {
    p_gym_id: context.gym.id,
    p_profile_id: profileId,
    p_role: role,
  });
  revalidatePath("/parametres");
  redirect(withFlash(TEAM, error ? { error: errorMessageKey(error) } : { ok: "team.removed" }));
}
