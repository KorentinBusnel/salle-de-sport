"use server";

import {
  PLANNING_COLORS,
  PLANNING_LAYOUTS,
  planningFiltersSchema,
  VIEW_NAME_MAX,
  VIEW_VISIBILITIES,
  type PlanningLayout,
  type ViewVisibility,
} from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@salle/supabase";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { isManagerRole, requireTeamContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/*
 * Vues enregistrées du planning (saved_views, objet « planning ») : filtres (disciplines,
 * coachs, salles, mes séances), affichage (semaine ou jour) et couleur (rangée dans group_by).
 * Toute l'équipe crée des vues personnelles ; seul le gérant publie une vue d'équipe (RLS).
 * Renommer, partager et supprimer passent par les actions communes (adherents/vues-actions).
 */

const stateSchema = z.object({
  filters: planningFiltersSchema,
  color: z.enum(PLANNING_COLORS),
});
type PlanningState = z.infer<typeof stateSchema>;

function done<T>(result: T): T {
  revalidatePath("/planning");
  refresh();
  return result;
}

export async function createPlanningView(input: {
  name: string;
  visibility: ViewVisibility;
  layout: PlanningLayout;
  state: PlanningState;
}): Promise<ActionResult<{ id: string }>> {
  const context = await requireTeamContext();
  const name = z.string().trim().min(1).max(VIEW_NAME_MAX).safeParse(input.name);
  const visibility = z.enum(VIEW_VISIBILITIES).safeParse(input.visibility);
  const layout = z.enum(PLANNING_LAYOUTS).safeParse(input.layout);
  const state = stateSchema.safeParse(input.state);
  if (!name.success) return fail("views.errors.name");
  if (!visibility.success || !layout.success || !state.success) return fail("views.errors.save");
  if (visibility.data === "team" && !isManagerRole(context.role))
    return fail("views.errors.notAllowed");

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("saved_views")
    .select("position")
    .eq("gym_id", context.gym.id)
    .eq("object", "planning")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("saved_views")
    .insert({
      gym_id: context.gym.id,
      object: "planning",
      layout: layout.data,
      name: name.data,
      visibility: visibility.data,
      filters: state.data.filters as NonNullable<Json>,
      group_by: state.data.color,
      created_by: context.userId,
      position: (last?.position ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error || !data) return fail("views.errors.save");
  return done({ ok: true, message: "views.created", data: { id: data.id } });
}

/** « Enregistrer » : filtres et couleur courants (l'affichage appartient à la vue). */
export async function updatePlanningView(input: {
  id: string;
  state: PlanningState;
}): Promise<ActionResult> {
  await requireTeamContext();
  const id = z.guid().safeParse(input.id);
  const state = stateSchema.safeParse(input.state);
  if (!id.success || !state.success) return fail("views.errors.save");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_views")
    .update({ filters: state.data.filters as NonNullable<Json>, group_by: state.data.color })
    .eq("id", id.data)
    .eq("object", "planning")
    .select("id");
  if (error) return fail("views.errors.save");
  if (!data?.length) return fail("views.errors.notAllowed");
  return done(ok("views.saved"));
}
