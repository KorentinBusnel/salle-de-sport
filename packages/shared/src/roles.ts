import { z } from "zod";

/**
 * Rôles d'un profil dans une salle (BRIEF §4). Un même profil peut avoir
 * des rôles différents selon la salle.
 */
export const GYM_ROLES = ["member", "coach", "staff", "manager", "admin"] as const;

export const gymRoleSchema = z.enum(GYM_ROLES);

export type GymRole = z.infer<typeof gymRoleSchema>;

/** Seuls les gérants et admins voient les données financières (BRIEF §4, §6). */
export function canSeeFinancials(role: GymRole): boolean {
  return role === "manager" || role === "admin";
}

/** Rôles qui accèdent au back office. */
export function isStaffRole(role: GymRole): boolean {
  return role !== "member";
}

/** Rôles d'équipe, du plus étendu au plus restreint. */
const TEAM_ROLE_PRIORITY: readonly GymRole[] = ["admin", "manager", "staff", "coach"];

/**
 * Rôle qui détermine l'accès au back office quand un profil cumule plusieurs
 * rôles dans une salle ; null s'il n'a aucun rôle d'équipe.
 */
export function primaryTeamRole(roles: readonly GymRole[]): GymRole | null {
  return TEAM_ROLE_PRIORITY.find((role) => roles.includes(role)) ?? null;
}
