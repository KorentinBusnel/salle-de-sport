"use server";

import {
  LABEL_MAX,
  MAX_OPTIONS,
  MEMBER_FIELD_TYPES,
  memberFieldOptionSchema,
  OPTION_LABEL_MAX,
  isChoiceField,
  slugifyOptionValue,
  type MemberFieldOption,
} from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@salle/supabase";
import type { CellValue } from "@/components/inline/editable-cell";
import type { NewFieldState } from "@/components/settings/new-field-dialog";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { isManagerRole, requireRole } from "@/lib/auth";
import { errorMessageKey } from "@/lib/flash";
import type { MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

/*
 * Champs personnalisés des adhérents (Paramètres › Champs) : chaque action valide par Zod puis
 * appelle la fonction SQL (create_member_field, update_member_field, delete_member_field,
 * reorder_member_fields), seule détentrice de la règle (droits du gérant, 30 champs, clé
 * immuable, options retirées effacées des fiches). Le client affiche un toast ; l'écran est
 * rafraîchi par refresh().
 */

type Result = { error: MessageKey | null; message?: MessageKey | undefined };

const labelSchema = z.string().trim().min(1).max(LABEL_MAX);
const optionLabelSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(z.string().min(1).max(OPTION_LABEL_MAX));

function done(error: { message?: string } | null): Result {
  revalidatePath("/parametres");
  // Les fiches affichent libellés, options et champs actifs.
  revalidatePath("/adherents", "layout");
  refresh();
  return error ? { error: errorMessageKey(error) } : { error: null, message: "fields.saved" };
}

function settle(error: { message?: string } | null, message: MessageKey): ActionResult {
  if (error) return fail(errorMessageKey(error));
  revalidatePath("/parametres");
  revalidatePath("/adherents", "layout");
  refresh();
  return ok(message);
}

/** Valeur libre d'une option : slug du libellé, puis `_2`, `_3`… si elle est déjà prise. */
function freeOptionValue(label: string, taken: Set<string>): string {
  const base = slugifyOptionValue(label) || "option";
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) {
    const suffix = `_${n}`;
    candidate = `${base.slice(0, 40 - suffix.length)}${suffix}`;
  }
  taken.add(candidate);
  return candidate;
}

/** Libellé d'option tel que saisi (TagInput le met en minuscules) : initiale en capitale. */
function capitalize(label: string): string {
  return label.charAt(0).toLocaleUpperCase("fr-FR") + label.slice(1);
}

/** Création d'un champ (dialogue « Nouveau champ ») : libellé, type immuable, premières options. */
export async function createMemberField(
  _previous: NewFieldState,
  formData: FormData,
): Promise<NewFieldState> {
  const context = await requireRole(isManagerRole);
  const type = z.enum(MEMBER_FIELD_TYPES).safeParse(formData.get("type"));
  const values: NewFieldState["values"] = {
    label: String(formData.get("label") ?? ""),
    type: type.success ? type.data : "text",
    options: formData.getAll("options").map(String),
  };
  const fieldErrors: NewFieldState["fieldErrors"] = {};
  const label = labelSchema.safeParse(values.label);
  if (!label.success) fieldErrors.label = "fields.errors.label";
  if (!type.success) fieldErrors.type = "fields.errors.type";
  const optionLabels = z
    .array(optionLabelSchema)
    .max(MAX_OPTIONS)
    .safeParse(type.success && isChoiceField(type.data) ? values.options : []);
  if (!optionLabels.success) fieldErrors.options = "fields.errors.options";
  if (!label.success || !type.success || !optionLabels.success) return { values, fieldErrors };

  const taken = new Set<string>();
  const options: MemberFieldOption[] = optionLabels.data.map((text) => ({
    value: freeOptionValue(text, taken),
    label: capitalize(text),
    tone: "neutral",
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_member_field", {
    p_gym_id: context.gym.id,
    p_label: label.data,
    p_type: type.data,
    p_options: options as unknown as Json,
  });
  if (error || !data) {
    return { values, fieldErrors: {}, error: errorMessageKey(error) };
  }
  revalidatePath("/parametres");
  revalidatePath("/adherents", "layout");
  return {
    values: { label: "", type: "text", options: [] },
    fieldErrors: {},
    createdId: String(data),
  };
}

const editableFields = {
  label: labelSchema,
  staff_can_edit: z.boolean(),
  is_active: z.boolean(),
} as const;

/** Libellé ou interrupteur modifié sur place (EditableCell). */
export async function updateMemberField(input: {
  id: string;
  field: string;
  value: CellValue;
}): Promise<Result> {
  await requireRole(isManagerRole);
  const field = z
    .enum(Object.keys(editableFields) as [keyof typeof editableFields])
    .safeParse(input.field);
  if (!field.success || !z.guid().safeParse(input.id).success)
    return { error: "fields.errors.invalid" };
  const value = editableFields[field.data].safeParse(input.value);
  if (!value.success) return { error: "fields.errors.invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member_field", {
    p_id: input.id,
    p_changes: { [field.data]: value.data },
  });
  return done(error);
}

const optionsSchema = z
  .array(memberFieldOptionSchema)
  .max(MAX_OPTIONS)
  .refine((options) => new Set(options.map((option) => option.value)).size === options.length);

/** Liste complète des options d'un champ liste (ajout, renommage, ton, retrait). */
export async function updateFieldOptions(input: {
  id: string;
  options: MemberFieldOption[];
}): Promise<ActionResult> {
  await requireRole(isManagerRole);
  const id = z.guid().safeParse(input.id);
  const options = optionsSchema.safeParse(input.options);
  if (!id.success || !options.success) return fail("fields.errors.options");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member_field", {
    p_id: id.data,
    p_changes: { options: options.data as unknown as Json },
  });
  return settle(error, "fields.optionsSaved");
}

/** Suppression d'un champ et de toutes ses valeurs (confirmée côté client). */
export async function deleteMemberField(input: { id: string }): Promise<ActionResult> {
  await requireRole(isManagerRole);
  const id = z.guid().safeParse(input.id);
  if (!id.success) return fail("fields.errors.invalid");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_member_field", { p_id: id.data });
  return settle(error, "fields.deleted");
}

/** Ordre des champs sur la fiche (identifiants dans l'ordre voulu). */
export async function reorderMemberFields(input: { ids: string[] }): Promise<ActionResult> {
  const context = await requireRole(isManagerRole);
  const ids = z.array(z.guid()).min(1).max(200).safeParse(input.ids);
  if (!ids.success) return fail("fields.errors.invalid");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_member_fields", {
    p_gym_id: context.gym.id,
    p_ids: ids.data,
  });
  return settle(error, "fields.reordered");
}
