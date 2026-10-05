import { type GymRole } from "@salle/shared";
import type { NavGroup, NavItem } from "@/components/app-sidebar";
import { isFrontDeskRole, isManagerRole } from "@/lib/auth-roles";
import { t } from "@/lib/i18n";

export type Navigation = { groups: NavGroup[]; footer: NavItem[] };

const withBadge = (item: NavItem, count: number): NavItem =>
  count > 0 ? { ...item, badge: count } : item;

/**
 * Barre latérale par rôle :
 * - Quotidien : ce qu'on ouvre chaque jour (accueil, Hub, planning, indicateurs ; fiche et
 *   heures pour un coach) ;
 * - Opérations : gestion des adhérents, de la relation client, des coachs et des cours ;
 * - en pied, Paramètres (gérant) : la configuration sort du travail courant.
 * Les pastilles comptent ce qui attend une action (prospects, messages sans réponse).
 */
export function buildNavigation(
  role: GymRole,
  options: { prospects: number; unanswered: number; ownCoachId: string | null },
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
    ...when(frontDesk, [
      withBadge(
        { href: "/adherents", label: t("nav.members"), icon: "members" },
        options.prospects,
      ),
    ]),
    ...when(manager, [
      { href: "/crm", label: t("nav.crm"), icon: "crm" },
      { href: "/segments", label: t("nav.segments"), icon: "segments" },
      { href: "/emailing", label: t("nav.emailing"), icon: "emailing" },
      withBadge(
        { href: "/messages", label: t("nav.messages"), icon: "messages" },
        options.unanswered,
      ),
      { href: "/coachs", label: t("nav.coaches"), icon: "coaches" },
      { href: "/planning/modeles", label: t("nav.templates"), icon: "templates" },
    ]),
  ];

  return {
    groups: [
      { label: t("nav.groupDaily"), items: daily },
      { label: t("nav.groupOperations"), items: operations },
    ].filter((group) => group.items.length > 0),
    footer: when(manager, [{ href: "/parametres", label: t("nav.settings"), icon: "settings" }]),
  };
}
