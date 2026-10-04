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
