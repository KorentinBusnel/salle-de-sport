"use server";

import {
  memberViewSchema,
  VIEW_NAME_MAX,
  VIEW_VISIBILITIES,
  type ViewVisibility,
} from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@salle/supabase";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { isFrontDeskRole, isManagerRole, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/*
 * Vues enregistrées des adhérents (saved_views, objet « members ») : CRUD direct sous RLS,
 * validation Zod ici. La base tranche les droits (vue personnelle : son créateur ; vue
 * d'équipe : le gérant) ; une écriture refusée ne touche aucune ligne.
 */

const stateSchema = memberViewSchema.pick({ filters: true, sort: true, columns: true });
const nameSchema = z.string().trim().min(1).max(VIEW_NAME_MAX);
const idSchema = z.guid();
type ViewState = z.infer<typeof stateSchema>;

function done<T>(result: T): T {
  revalidatePath("/adherents");
  refresh();
  return result;
}

/** « Enregistrer comme… » : nouvelle vue à partir de l'état courant (filtres, tri, colonnes). */
export async function createMemberView(input: {
  name: string;
  visibility: ViewVisibility;
  state: ViewState;
}): Promise<ActionResult<{ id: string }>> {
  const context = await requireRole(isFrontDeskRole);
  const name = nameSchema.safeParse(input.name);
  const visibility = z.enum(VIEW_VISIBILITIES).safeParse(input.visibility);
  const state = stateSchema.safeParse(input.state);
  if (!name.success) return fail("views.errors.name");
  if (!visibility.success || !state.success) return fail("views.errors.save");
  if (visibility.data === "team" && !isManagerRole(context.role))
    return fail("views.errors.notAllowed");

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("saved_views")
    .select("position")
    .eq("gym_id", context.gym.id)
    .eq("object", "members")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("saved_views")
    .insert({
      gym_id: context.gym.id,
      object: "members",
      layout: "table",
      name: name.data,
      visibility: visibility.data,
      filters: state.data.filters as NonNullable<Json>,
      sort: state.data.sort,
      columns: state.data.columns,
      created_by: context.userId,
      position: (last?.position ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error || !data) return fail("views.errors.save");
  return done({ ok: true, message: "views.created", data: { id: data.id } });
}

/** « Enregistrer » : l'état courant remplace celui de la vue. */
export async function updateMemberView(input: {
  id: string;
  state: ViewState;
}): Promise<ActionResult> {
  await requireRole(isFrontDeskRole);
  const id = idSchema.safeParse(input.id);
  const state = stateSchema.safeParse(input.state);
  if (!id.success || !state.success) return fail("views.errors.save");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_views")
    .update({
      filters: state.data.filters as NonNullable<Json>,
      sort: state.data.sort,
      columns: state.data.columns,
    })
    .eq("id", id.data)
    .select("id");
  if (error) return fail("views.errors.save");
  if (!data?.length) return fail("views.errors.notAllowed");
  return done(ok("views.saved"));
}

export async function renameMemberView(input: { id: string; name: string }): Promise<ActionResult> {
  await requireRole(isFrontDeskRole);
  const id = idSchema.safeParse(input.id);
  const name = nameSchema.safeParse(input.name);
  if (!id.success) return fail("views.errors.save");
  if (!name.success) return fail("views.errors.name");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_views")
    .update({ name: name.data })
    .eq("id", id.data)
    .select("id");
  if (error) return fail("views.errors.save");
  if (!data?.length) return fail("views.errors.notAllowed");
  return done(ok("views.renamed"));
}

/** Partager avec l'équipe (gérant) ou rendre personnelle (son créateur). */
export async function setMemberViewVisibility(input: {
  id: string;
  visibility: ViewVisibility;
}): Promise<ActionResult> {
  await requireRole(isFrontDeskRole);
  const id = idSchema.safeParse(input.id);
  const visibility = z.enum(VIEW_VISIBILITIES).safeParse(input.visibility);
  if (!id.success || !visibility.success) return fail("views.errors.save");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_views")
    .update({ visibility: visibility.data })
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) return fail("views.errors.notAllowed");
  return done(ok(visibility.data === "team" ? "views.shared" : "views.unshared"));
}

export async function deleteMemberView(input: { id: string }): Promise<ActionResult> {
  await requireRole(isFrontDeskRole);
  const id = idSchema.safeParse(input.id);
  if (!id.success) return fail("views.errors.save");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_views")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) return fail("views.errors.save");
  if (!data?.length) return fail("views.errors.notAllowed");
  return done(ok("views.deleted"));
}
