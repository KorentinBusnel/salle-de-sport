"use server";

import { BILLING_INTERVALS, PLAN_TYPES, promoCodeSchema } from "@salle/shared";
import type { TablesUpdate } from "@salle/supabase";
import { refresh } from "next/cache";
import { z } from "zod";
import type { CellValue } from "@/components/inline/editable-cell";
import { isManagerRole, requireRole } from "@/lib/auth";
import type { MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

type Result = { error: MessageKey | null };

const euros = z.number().min(0).max(100_000);
/** 0 = sans (engagement, validité, utilisations). */
const optionalCount = (max: number) =>
  z
    .number()
    .int()
    .min(0)
    .max(max)
    .transform((v) => (v === 0 ? null : v));

const planFields = {
  name: z.string().trim().min(1).max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null),
  audience: z
    .string()
    .trim()
    .max(60)
    .transform((v) => v || null),
  price: euros,
  billing_interval: z.enum(BILLING_INTERVALS),
  commitment_months: optionalCount(36),
  credits: z.number().int().min(1).max(500),
  validity_days: optionalCount(1095),
  requires_proof: z.boolean(),
  is_active: z.boolean(),
  type: z.enum(PLAN_TYPES),
  disciplines: z.array(z.guid()).max(50),
} as const;

function failure(error: { code?: string } | null): Result {
  if (!error) return { error: null };
  return { error: error.code === "23505" ? "catalog.errors.duplicate" : "common.unexpectedError" };
}

/**
 * Offre modifiée cellule par cellule. Changer le type remet les champs incompatibles à des
 * valeurs sûres (un abonnement mensuel sans crédits, un carnet de 10 crédits).
 */
export async function updatePlan(input: {
  id: string;
  field: string;
  value: CellValue;
}): Promise<Result> {
  const context = await requireRole(isManagerRole);
  const field = z.enum(Object.keys(planFields) as [keyof typeof planFields]).safeParse(input.field);
  if (!field.success || !z.guid().safeParse(input.id).success)
    return { error: "catalog.errors.invalid" };
  const parsed = planFields[field.data].safeParse(input.value);
  if (!parsed.success) return { error: "catalog.errors.invalid" };
  const supabase = await createClient();

  if (field.data === "disciplines") {
    const ids = parsed.data as string[];
    const { error: clear } = await supabase
      .from("plan_disciplines")
      .delete()
      .eq("plan_id", input.id);
    if (clear) return failure(clear);
    if (ids.length) {
      const { error } = await supabase.from("plan_disciplines").insert(
        ids.map((discipline_id) => ({
          gym_id: context.gym.id,
          plan_id: input.id,
          discipline_id,
        })),
      );
      if (error) return failure(error);
    }
    // Aucune discipline cochée : l'offre couvre tout.
    const { error } = await supabase
      .from("plans")
      .update({ all_disciplines: ids.length === 0 })
      .eq("id", input.id)
      .eq("gym_id", context.gym.id);
    refresh();
    return failure(error);
  }

  let changes: TablesUpdate<"plans">;
  if (field.data === "price") {
    changes = { price_cents: Math.round((parsed.data as number) * 100) };
  } else if (field.data === "type") {
    const type = parsed.data as (typeof PLAN_TYPES)[number];
    const { data: plan } = await supabase
      .from("plans")
      .select("credits, billing_interval")
      .eq("id", input.id)
      .single();
    changes =
      type === "recurring"
        ? {
            type,
            billing_interval: plan?.billing_interval ?? "month",
            credits: null,
            validity_days: null,
          }
        : {
            type,
            billing_interval: null,
            commitment_months: null,
            credits: plan?.credits ?? (type === "single" ? 1 : 10),
          };
  } else {
    changes = { [field.data]: parsed.data } as TablesUpdate<"plans">;
  }
  const { error } = await supabase
    .from("plans")
    .update(changes)
    .eq("id", input.id)
    .eq("gym_id", context.gym.id);
  refresh();
  return failure(error);
}

/** Nouvelle offre : un carnet de 10 séances à compléter, inactive tant qu'elle n'est pas prête. */
export async function createPlan(): Promise<Result & { id?: string }> {
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("plans")
    .select("position")
    .eq("gym_id", context.gym.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("plans")
    .insert({
      gym_id: context.gym.id,
      name: "Nouvelle offre",
      type: "pack",
      price_cents: 0,
      credits: 10,
      is_active: false,
      position: (last?.position ?? 0) + 1,
    })
    .select("id")
    .single();
  refresh();
  return { ...failure(error), ...(data ? { id: data.id } : {}) };
}

const promoFields = {
  code: promoCodeSchema,
  kind: z.enum(["percent", "amount"]),
  value: z.number().min(0.01).max(100_000),
  plans: z.array(z.guid()).max(50),
  ends_on: z.iso.date().nullable(),
  max_redemptions: optionalCount(100_000),
  is_active: z.boolean(),
} as const;

/** Code promo modifié sur place (montant saisi en euros, pourcentage de 1 à 100). */
export async function updatePromo(input: {
  id: string;
  field: string;
  value: CellValue;
}): Promise<Result> {
  const context = await requireRole(isManagerRole);
  const field = z
    .enum(Object.keys(promoFields) as [keyof typeof promoFields])
    .safeParse(input.field);
  if (!field.success || !z.guid().safeParse(input.id).success)
    return { error: "catalog.errors.invalid" };
  const parsed = promoFields[field.data].safeParse(input.value);
  if (!parsed.success) return { error: "catalog.errors.invalid" };
  const supabase = await createClient();

  if (field.data === "plans") {
    const ids = parsed.data as string[];
    const { error: clear } = await supabase
      .from("promo_code_plans")
      .delete()
      .eq("promo_code_id", input.id);
    if (clear) return failure(clear);
    const { error } = ids.length
      ? await supabase
          .from("promo_code_plans")
          .insert(
            ids.map((plan_id) => ({ gym_id: context.gym.id, promo_code_id: input.id, plan_id })),
          )
      : { error: null };
    refresh();
    return failure(error);
  }

  let changes: TablesUpdate<"promo_codes">;
  if (field.data === "value" || field.data === "kind") {
    const { data: promo } = await supabase
      .from("promo_codes")
      .select("kind, value")
      .eq("id", input.id)
      .single();
    if (!promo) return { error: "catalog.errors.invalid" };
    const kind = field.data === "kind" ? (parsed.data as "percent" | "amount") : promo.kind;
    // Pourcentage : nombre entier ; montant : saisi en euros, stocké en centimes.
    const raw = field.data === "value" ? (parsed.data as number) : 10;
    const value = kind === "percent" ? Math.round(raw) : Math.round(raw * 100);
    if (kind === "percent" && (value < 1 || value > 100))
      return { error: "catalog.errors.invalid" };
    changes = { kind, value };
  } else {
    changes = { [field.data]: parsed.data } as TablesUpdate<"promo_codes">;
  }
  const { error } = await supabase
    .from("promo_codes")
    .update(changes)
    .eq("id", input.id)
    .eq("gym_id", context.gym.id);
  refresh();
  return failure(error);
}

/** Nouveau code : 10 %, inactif tant qu'il n'est pas prêt, nom libre « CODE1 », « CODE2 »… */
export async function createPromo(): Promise<Result & { id?: string }> {
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const { data: codes } = await supabase
    .from("promo_codes")
    .select("code")
    .eq("gym_id", context.gym.id);
  const taken = new Set((codes ?? []).map((row) => row.code));
  let n = 1;
  while (taken.has(`CODE${n}`)) n++;
  const { data, error } = await supabase
    .from("promo_codes")
    .insert({
      gym_id: context.gym.id,
      code: `CODE${n}`,
      kind: "percent",
      value: 10,
      is_active: false,
    })
    .select("id")
    .single();
  refresh();
  return { ...failure(error), ...(data ? { id: data.id } : {}) };
}
