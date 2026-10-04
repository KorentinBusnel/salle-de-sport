import "server-only";
import { type GymRole, primaryTeamRole } from "@salle/shared";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type TeamContext = {
  userId: string;
  displayName: string;
  role: GymRole;
  gym: { id: string; name: string; timezone: string };
};

type ContextResult =
  { status: "anonymous" } | { status: "no-team" } | { status: "team"; context: TeamContext };

/**
 * Identité de l'utilisateur connecté et son rôle d'équipe. Mémorisé pour la
 * durée de la requête. Une seule salle au MVP : la première où il a un rôle d'équipe.
 */
export const getTeamContext = cache(async (): Promise<ContextResult> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return { status: "anonymous" };

  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase
      .from("gym_roles")
      .select("role, gyms(id, name, timezone)")
      .eq("profile_id", userId)
      .order("gym_id"),
    supabase.from("profiles").select("first_name, last_name").eq("id", userId).maybeSingle(),
  ]);

  const rolesByGym = new Map<string, { gym: TeamContext["gym"]; roles: GymRole[] }>();
  for (const row of roles ?? []) {
    if (!row.gyms) continue;
    const entry = rolesByGym.get(row.gyms.id) ?? { gym: row.gyms, roles: [] };
    entry.roles.push(row.role);
    rolesByGym.set(row.gyms.id, entry);
  }

  for (const { gym, roles: gymRoles } of rolesByGym.values()) {
    const role = primaryTeamRole(gymRoles);
    if (role) {
      const displayName =
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        String(auth.claims.email ?? "");
      return { status: "team", context: { userId, displayName, role, gym } };
    }
  }
  return { status: "no-team" };
});

/** Contexte d'équipe obligatoire : redirige vers /login sinon (avec le motif si connecté). */
export async function requireTeamContext(): Promise<TeamContext> {
  const result = await getTeamContext();
  if (result.status === "no-team") redirect("/login?motif=sans-role");
  if (result.status !== "team") redirect("/login");
  return result.context;
}

export { isFrontDeskRole, isManagerRole } from "@/lib/auth-roles";

/** Contexte d'équipe avec un rôle suffisant : retour à l'accueil avec un message sinon. */
export async function requireRole(allowed: (role: GymRole) => boolean): Promise<TeamContext> {
  const context = await requireTeamContext();
  if (!allowed(context.role)) redirect("/?erreur=errors.forbiddenRole");
  return context;
}
