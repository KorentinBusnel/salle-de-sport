"use server";

import { MP_ORDER_STATUSES, zonedInstant } from "@salle/shared";
import type { TablesUpdate } from "@salle/supabase";
import { refresh } from "next/cache";
import { z } from "zod";
import type { CellValue } from "@/components/inline/editable-cell";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { requireRole } from "@/lib/auth";
import { callBilling } from "@/lib/billing";
import { errorMessageKey } from "@/lib/flash";
import type { MessageKey } from "@/lib/i18n";
import { stripeErrorKey } from "@/lib/stripe-errors";
import { createClient } from "@/lib/supabase/server";

type Result = { error: MessageKey | null };

/** Espace Plateforme : administrateurs (rôle admin) ; la RLS (is_platform_admin) fait foi. */
const requireAdmin = () => requireRole((role) => role === "admin");

const euros = z.number().min(0).max(1_000_000);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

function failure(error: { code?: string; message?: string } | null): Result {
  if (!error) return { error: null };
  return { error: error.code === "23505" ? "platform.errors.duplicate" : "common.unexpectedError" };
}

const productFields = {
  name: z.string().trim().min(1).max(120),
  brand: optionalText(80),
  description: optionalText(1000),
  unit: optionalText(60),
  kind: z.enum(["product", "service"]),
  category_id: z.guid().nullable(),
  supplier_id: z.guid().nullable(),
  list_price: euros.nullable(),
  price: euros.nullable(),
  cost: euros.nullable(),
  is_active: z.boolean(),
} as const;

/** Produit modifié cellule par cellule (prix saisis en euros, stockés en centimes). */
export async function updateProduct(input: {
  id: string;
  field: string;
  value: CellValue;
}): Promise<Result> {
  await requireAdmin();
  const field = z
    .enum(Object.keys(productFields) as [keyof typeof productFields])
    .safeParse(input.field);
  if (!field.success || !z.guid().safeParse(input.id).success)
    return { error: "platform.errors.invalid" };
  const parsed = productFields[field.data].safeParse(input.value);
  if (!parsed.success) return { error: "platform.errors.invalid" };
  const supabase = await createClient();
  const cents = (v: unknown) => (v === null ? null : Math.round((v as number) * 100));

  if (field.data === "cost") {
    const value = cents(parsed.data);
    const { error } =
      value === null
        ? await supabase.from("mp_product_costs").delete().eq("product_id", input.id)
        : await supabase.from("mp_product_costs").upsert({
            product_id: input.id,
            cost_cents: value,
            updated_at: new Date().toISOString(),
          });
    refresh();
    return failure(error);
  }
  const changes: TablesUpdate<"mp_products"> =
    field.data === "price"
      ? { price_cents: cents(parsed.data) }
      : field.data === "list_price"
        ? { list_price_cents: cents(parsed.data) }
        : field.data === "kind" && parsed.data === "service"
          ? { kind: "service", price_cents: null, list_price_cents: null }
          : ({ [field.data]: parsed.data } as TablesUpdate<"mp_products">);
  const { error } = await supabase.from("mp_products").update(changes).eq("id", input.id);
  refresh();
  // Activation d'un produit sans prix : refusée par la base (contrainte).
  if (error?.code === "23514") return { error: "platform.errors.priceRequired" };
  return failure(error);
}

/** Nouveau produit : inactif tant qu'il n'est pas complété. */
export async function createProduct(): Promise<Result & { id?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mp_products")
    .insert({ name: "Nouveau produit", kind: "product", is_active: false })
    .select("id")
    .single();
  refresh();
  return { ...failure(error), ...(data ? { id: data.id } : {}) };
}

const supplierFields = {
  name: z.string().trim().min(1).max(120),
  contact_name: optionalText(120),
  email: optionalText(160),
  phone: optionalText(40),
  notes: optionalText(2000),
} as const;

export async function updateSupplier(input: {
  id: string;
  field: string;
  value: CellValue;
}): Promise<Result> {
  await requireAdmin();
  const field = z
    .enum(Object.keys(supplierFields) as [keyof typeof supplierFields])
    .safeParse(input.field);
  if (!field.success || !z.guid().safeParse(input.id).success)
    return { error: "platform.errors.invalid" };
  const parsed = supplierFields[field.data].safeParse(input.value);
  if (!parsed.success) return { error: "platform.errors.invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("mp_suppliers")
    .update({ [field.data]: parsed.data } as TablesUpdate<"mp_suppliers">)
    .eq("id", input.id);
  refresh();
  return failure(error);
}

export async function createSupplier(): Promise<Result & { id?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mp_suppliers")
    .insert({ name: "Nouveau fournisseur" })
    .select("id")
    .single();
  refresh();
  return { ...failure(error), ...(data ? { id: data.id } : {}) };
}

export async function updateCategory(input: {
  id: string;
  field: string;
  value: CellValue;
}): Promise<Result> {
  await requireAdmin();
  const name = z.string().trim().min(1).max(60).safeParse(input.value);
  if (input.field !== "name" || !name.success || !z.guid().safeParse(input.id).success)
    return { error: "platform.errors.invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("mp_categories")
    .update({ name: name.data })
    .eq("id", input.id);
  refresh();
  return failure(error);
}

export async function createCategory(): Promise<Result & { id?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("mp_categories")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("mp_categories")
    .insert({ name: `Catégorie ${(last?.position ?? 0) + 1}`, position: (last?.position ?? 0) + 1 })
    .select("id")
    .single();
  refresh();
  return { ...failure(error), ...(data ? { id: data.id } : {}) };
}

const tiersSchema = z
  .array(z.object({ min_qty: z.number().int().min(2).max(100000), price: euros }))
  .max(10)
  .refine((rows) => new Set(rows.map((r) => r.min_qty)).size === rows.length);

/** Paliers d'un produit, remplacés en bloc. */
export async function saveTiers(input: {
  productId: string;
  tiers: { min_qty: number; price: number }[];
}): Promise<ActionResult> {
  await requireAdmin();
  const id = z.guid().safeParse(input.productId);
  const tiers = tiersSchema.safeParse(input.tiers);
  if (!id.success || !tiers.success) return fail("platform.errors.tiers");
  const supabase = await createClient();
  const { error: clear } = await supabase.from("mp_price_tiers").delete().eq("product_id", id.data);
  if (clear) return fail("common.unexpectedError");
  if (tiers.data.length) {
    const { error } = await supabase.from("mp_price_tiers").insert(
      tiers.data.map((tier) => ({
        product_id: id.data,
        min_qty: tier.min_qty,
        unit_price_cents: Math.round(tier.price * 100),
      })),
    );
    if (error) return fail("common.unexpectedError");
  }
  refresh();
  return ok("platform.tiersSaved");
}

/** Image d'un produit : bucket public « marketplace », un fichier par produit. */
export async function uploadProductImage(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = z.guid().safeParse(formData.get("productId"));
  const file = formData.get("file");
  if (!id.success || !(file instanceof File)) return fail("platform.errors.image");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024)
    return fail("platform.errors.image");
  const supabase = await createClient();
  const extension = file.type.split("/")[1] ?? "png";
  const path = `products/${id.data}-${Date.now()}.${extension}`;
  const { error: upload } = await supabase.storage
    .from("marketplace")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upload) return fail("platform.errors.image");
  const { error } = await supabase
    .from("mp_products")
    .update({ image_path: path })
    .eq("id", id.data);
  if (error) return fail("common.unexpectedError");
  refresh();
  return ok("platform.imageSaved");
}

const answerSchema = z.object({
  quoteId: z.guid(),
  unitPrice: z.number().min(0).max(1_000_000),
  validUntil: z.iso.date(),
  note: z.string().trim().max(2000),
});

/** Réponse à une demande de devis : prix unitaire, validité, note. */
export async function answerQuote(input: z.input<typeof answerSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return fail("platform.errors.invalid");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mp_answer_quote", {
    p_quote_id: parsed.data.quoteId,
    p_unit_price_cents: Math.round(parsed.data.unitPrice * 100),
    p_valid_until: parsed.data.validUntil,
    p_note: parsed.data.note,
  });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok("platform.quoteAnswered");
}

/** Suivi d'une commande : étape suivante ou annulation. */
export async function setOrderStatus(input: { id: string; status: string }): Promise<ActionResult> {
  await requireAdmin();
  const id = z.guid().safeParse(input.id);
  const status = z.enum(MP_ORDER_STATUSES).safeParse(input.status);
  if (!id.success || !status.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mp_set_order_status", {
    p_order_id: id.data,
    p_status: status.data,
  });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok("platform.orderUpdated");
}

const campaignSchema = z.object({
  productId: z.guid(),
  endsOn: z.iso.date(),
  minQty: z.number().int().min(1).max(100000),
  title: z.string().trim().max(120),
});

/** Nouvel achat groupé : clôture le soir du jour choisi (fuseau de la salle de l'admin). */
export async function createCampaign(input: z.input<typeof campaignSchema>): Promise<ActionResult> {
  const context = await requireAdmin();
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return fail("common.unexpectedError");
  const endsAt = zonedInstant(parsed.data.endsOn, 23 * 60 + 59, context.gym.timezone);
  const supabase = await createClient();
  const { error } = await supabase.rpc("mp_create_campaign", {
    p_product_id: parsed.data.productId,
    p_ends_at: endsAt.toISOString(),
    p_min_qty: parsed.data.minQty,
    p_title: parsed.data.title,
  });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok("platform.campaigns.created");
}

/** Annulation d'un achat groupé ouvert : rien n'est débité. */
export async function cancelCampaign(input: { id: string }): Promise<ActionResult> {
  await requireAdmin();
  const id = z.guid().safeParse(input.id);
  if (!id.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mp_cancel_campaign", { p_campaign_id: id.data });
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok("platform.campaigns.cancelled");
}

/**
 * Clôture d'un achat groupé : commandes au palier atteint et débit des cartes enregistrées
 * (Edge Function). Sous le minimum, la base annule la campagne sans rien débiter.
 */
export async function closeCampaign(input: { id: string }): Promise<ActionResult> {
  await requireAdmin();
  const id = z.guid().safeParse(input.id);
  if (!id.success) return fail("common.unexpectedError");
  const result = await callBilling({ action: "mp_close_campaign", campaignId: id.data });
  if (!result.ok) return fail(stripeErrorKey(result.error));
  refresh();
  const data = result.data as { status?: string; charged?: number; failed?: number } | null;
  if (data?.status === "cancelled") return ok("platform.campaigns.belowMinimum");
  if (data?.failed) return ok("platform.campaigns.closedWithFailures", data.failed);
  return ok("platform.campaigns.closed", data?.charged ?? 0);
}
