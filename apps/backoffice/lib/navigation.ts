import { type GymRole } from "@salle/shared";
import type { NavGroup, NavItem } from "@/components/app-sidebar";
import { isFrontDeskRole, isManagerRole } from "@/lib/auth-roles";
import { t } from "@/lib/i18n";

export type Navigation = { groups: NavGroup[]; footer: NavItem[] };

/** Compteurs possibles d'une pastille (fonction SQL nav_counts). */
export const BADGE_KEYS = ["prospects", "unanswered", "trials_to_call", "unpaid"] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];

/** Entrée qui porte chaque pastille. */
export const BADGE_HREF: Record<BadgeKey, string> = {
  prospects: "/adherents",
  unanswered: "/messages",
  trials_to_call: "/crm",
  unpaid: "/",
};

/** Pastilles affichées par défaut (réglables par le gérant). */
export const DEFAULT_BADGES: readonly BadgeKey[] = ["prospects", "unanswered"];

/**
 * Barre latérale par rôle :
 * - Quotidien : ce qu'on ouvre chaque jour (accueil, Hub, planning, indicateurs ; fiche et
 *   heures pour un coach) ;
 * - Opérations : gestion des adhérents, de la relation client, des coachs et des cours ;
 * - en pied, Paramètres (gérant) : la configuration sort du travail courant.
 * Les pastilles comptent ce qui attend une action (prospects, messages sans réponse…) : seule leur
 * place est décidée ici, les comptes arrivent à part (NavBadge, sous Suspense).
 */
export function buildNavigation(
  role: GymRole,
  options: { ownCoachId: string | null; badges?: readonly BadgeKey[] | undefined },
): Navigation {
  const manager = isManagerRole(role);
  const frontDesk = isFrontDeskRole(role);
  const when = (condition: boolean, items: NavItem[]) => (condition ? items : []);

  const daily: NavItem[] = [
    { href: "/", label: t("nav.today"), icon: "today" },
    ...when(manager, [{ href: "/hub", label: t("nav.hub"), icon: "hub" }]),
    { href: "/planning", label: t("nav.planning"), icon: "planning" },
    ...when(manager, [{ href: "/indicateurs", label: t("nav.kpis"), icon: "kpis" }]),
    ...when(!manager && options.ownCoachId !== null, [
      { href: `/coachs/${options.ownCoachId}`, label: t("nav.myProfile"), icon: "coaches" },
      { href: "/coachs/heures", label: t("nav.myHours"), icon: "hours" },
    ]),
  ];

  const operations: NavItem[] = [
    ...when(frontDesk, [{ href: "/adherents", label: t("nav.members"), icon: "members" }]),
    ...when(manager, [
      { href: "/crm", label: t("nav.crm"), icon: "crm" },
      { href: "/segments", label: t("nav.segments"), icon: "segments" },
      { href: "/emailing", label: t("nav.emailing"), icon: "emailing" },
      { href: "/messages", label: t("nav.messages"), icon: "messages" },
      { href: "/coachs", label: t("nav.coaches"), icon: "coaches" },
      { href: "/planning/modeles", label: t("nav.templates"), icon: "templates" },
    ]),
  ];

  // Pastilles : sur l'entrée qui les porte, si elle est visible pour ce rôle.
  const enabled = new Set(options.badges ?? DEFAULT_BADGES);
  const withBadges = (items: NavItem[]) =>
    items.map((item) => {
      const badge = BADGE_KEYS.find((key) => enabled.has(key) && BADGE_HREF[key] === item.href);
      return badge ? { ...item, badge } : item;
    });

  return {
    groups: [
      { label: t("nav.groupDaily"), items: withBadges(daily) },
      { label: t("nav.groupOperations"), items: withBadges(operations) },
    ].filter((group) => group.items.length > 0),
    footer: when(manager, [{ href: "/parametres", label: t("nav.settings"), icon: "settings" }]),
  };
}
