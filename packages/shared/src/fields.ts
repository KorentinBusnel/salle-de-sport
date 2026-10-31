import { z } from "zod";
import type { Tone } from "./display.ts";

/**
 * Champs personnalisés des adhérents : définitions (`member_fields`) et valeurs
 * (`member_field_values`). La règle fait foi en SQL (`set_member_field`,
 * `private.member_field_match`) ; ce module en est le miroir pour les formulaires et les filtres.
 */

/** Types de champ (contrainte `member_fields.type`). */
export const MEMBER_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "multi_select",
] as const;
export type MemberFieldType = (typeof MEMBER_FIELD_TYPES)[number];

/** Tons d'une option de liste : les cinq tons des pastilles (`TONE_CLASSES`). */
export const TONES = [
  "neutral",
  "brand",
  "success",
  "warning",
  "danger",
] as const satisfies readonly Tone[];

/** Bornes communes à la SQL et aux formulaires. */
export const MAX_FIELDS = 30;
export const LABEL_MAX = 60;
export const TEXT_MAX = 300;
export const OPTION_LABEL_MAX = 40;
export const MAX_OPTIONS = 30;
export const MAX_FIELD_CONDITIONS = 10;
export const NUMBER_BOUNDS = { min: -1_000_000_000, max: 1_000_000_000, decimals: 2 } as const;

/** Clé d'un champ ou valeur d'une option : slug stable, jamais modifié après création. */
export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const OPTION_VALUE_PATTERN = /^[a-z0-9][a-z0-9_]{0,39}$/;

/**
 * Slug d'un libellé, même règle que `create_member_field` : minuscules sans accents, tout le
 * reste en `_`, préfixe `f_` si la clé ne commence pas par une lettre, 40 caractères au plus.
 * (La SQL passe par `unaccent`, un peu plus large que la décomposition Unicode : la base fait foi.)
 */
export function slugifyFieldKey(label: string): string {
  let slug = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (slug === "") return "";
  if (!/^[a-z]/.test(slug)) slug = `f_${slug}`;
  return slug.slice(0, 40).replace(/_+$/g, "");
}

/** Valeur d'une option de liste à partir de son libellé (peut commencer par un chiffre). */
export function slugifyOptionValue(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/g, "");
}

export const memberFieldOptionSchema = z.object({
  value: z.string().regex(OPTION_VALUE_PATTERN),
  label: z.string().trim().min(1).max(OPTION_LABEL_MAX),
  tone: z.enum(TONES),
});
export type MemberFieldOption = z.infer<typeof memberFieldOptionSchema>;

/** Lit `member_fields.options` (colonne Json) : les entrées invalides ou en double sont ignorées. */
export function parseFieldOptions(raw: unknown): MemberFieldOption[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const options: MemberFieldOption[] = [];
  for (const entry of raw) {
    const parsed = memberFieldOptionSchema.safeParse(entry);
    if (!parsed.success || seen.has(parsed.data.value)) continue;
    seen.add(parsed.data.value);
    options.push(parsed.data);
  }
  return options.slice(0, MAX_OPTIONS);
}

export const memberFieldSchema = z.object({
  id: z.guid(),
  key: z.string().regex(FIELD_KEY_PATTERN),
  label: z.string().trim().min(1).max(LABEL_MAX),
  type: z.enum(MEMBER_FIELD_TYPES),
  options: z.array(memberFieldOptionSchema).max(MAX_OPTIONS),
  position: z.number().int(),
  staff_can_edit: z.boolean(),
  is_active: z.boolean(),
});
export type MemberField = z.infer<typeof memberFieldSchema>;

/** Une ligne de `member_fields` telle que lue en base (options en Json). */
export function parseMemberField(row: {
  id: string;
  key: string;
  label: string;
  type: string;
  options: unknown;
  position: number;
  staff_can_edit: boolean;
  is_active: boolean;
}): MemberField | null {
  const parsed = memberFieldSchema.safeParse({ ...row, options: parseFieldOptions(row.options) });
  return parsed.success ? parsed.data : null;
}

/** Un champ liste (simple ou multiple) : ses valeurs possibles. */
export function isChoiceField(type: MemberFieldType): boolean {
  return type === "select" || type === "multi_select";
}

const hasAtMostDecimals = (value: number, decimals: number) => {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
};

/** Valeur non vide d'un champ (une valeur vide se traduit par la suppression de la ligne). */
export type FieldValue = string | number | boolean | string[];

/** Schéma d'une valeur selon le champ : miroir de la validation de `set_member_field`. */
export function fieldValueSchema(
  field: Pick<MemberField, "type" | "options">,
): z.ZodType<FieldValue> {
  const values = field.options.map((option) => option.value);
  switch (field.type) {
    case "text":
      return z.string().trim().min(1).max(TEXT_MAX);
    case "number":
      return z
        .number()
        .finite()
        .min(NUMBER_BOUNDS.min)
        .max(NUMBER_BOUNDS.max)
        .refine((value) => hasAtMostDecimals(value, NUMBER_BOUNDS.decimals));
    case "date":
      return z.iso.date();
    case "boolean":
      return z.boolean();
    case "select":
      return z.string().refine((value) => values.includes(value));
    case "multi_select":
      return z
        .array(z.string().refine((value) => values.includes(value)))
        .min(1)
        .max(MAX_OPTIONS)
        .refine((list) => new Set(list).size === list.length);
  }
}

/** Libellé d'une option (ou la valeur brute si l'option a disparu). */
export function optionLabel(field: Pick<MemberField, "options">, value: string): string {
  return field.options.find((option) => option.value === value)?.label ?? value;
}

/** Opérateurs de filtre (`private.member_field_match`). */
export const FIELD_OPS = [
  "is",
  "is_not",
  "contains",
  "is_empty",
  "is_not_empty",
  "gte",
  "lte",
  "before",
  "after",
  "has_any",
] as const;
export type FieldOp = (typeof FIELD_OPS)[number];

/** Opérateurs proposés pour chaque type de champ, dans l'ordre d'affichage. */
export const FIELD_OPS_BY_TYPE: Record<MemberFieldType, readonly FieldOp[]> = {
  text: ["contains", "is", "is_not", "is_empty", "is_not_empty"],
  number: ["is", "is_not", "gte", "lte", "is_empty", "is_not_empty"],
  date: ["is", "before", "after", "is_empty", "is_not_empty"],
  // Seuls vrai / faux sont enregistrés : absent vaut faux.
  boolean: ["is"],
  select: ["is", "is_not", "is_empty", "is_not_empty"],
  multi_select: ["has_any", "is_empty", "is_not_empty"],
};

const key = z.string().regex(FIELD_KEY_PATTERN);
const scalar = z.union([z.string().max(TEXT_MAX), z.number().finite(), z.boolean()]);

/** Une condition sur un champ : `{ key, op, value }`, la valeur dépend de l'opérateur. */
export const fieldConditionSchema = z.discriminatedUnion("op", [
  z.object({ key, op: z.literal("is"), value: scalar }),
  z.object({ key, op: z.literal("is_not"), value: scalar }),
  z.object({ key, op: z.literal("contains"), value: z.string().trim().min(1).max(TEXT_MAX) }),
  z.object({ key, op: z.literal("is_empty") }),
  z.object({ key, op: z.literal("is_not_empty") }),
  z.object({ key, op: z.literal("gte"), value: z.number().finite() }),
  z.object({ key, op: z.literal("lte"), value: z.number().finite() }),
  z.object({ key, op: z.literal("before"), value: z.iso.date() }),
  z.object({ key, op: z.literal("after"), value: z.iso.date() }),
  z.object({
    key,
    op: z.literal("has_any"),
    value: z.array(z.string().max(40)).min(1).max(MAX_OPTIONS),
  }),
]);
export type FieldCondition = z.infer<typeof fieldConditionSchema>;

/** Type de cellule éditable (`EditableCell`) pour un type de champ. */
export function fieldToCellKind(
  type: MemberFieldType,
): "text" | "number" | "date" | "switch" | "select" | "multi" {
  switch (type) {
    case "text":
      return "text";
    case "number":
      return "number";
    case "date":
      return "date";
    case "boolean":
      return "switch";
    case "select":
      return "select";
    case "multi_select":
      return "multi";
  }
}
