import { type GymRole } from "@salle/shared";
import type { NavGroup, NavItem } from "@/components/app-sidebar";
import { isFrontDeskRole, isManagerRole } from "@/lib/auth-roles";
import { t } from "@/lib/i18n";

/**
 * Barre latérale par rôle, en trois blocs :
 * - Quotidien : ce qu'on ouvre chaque jour (accueil, Hub, planning, indicateurs ; fiche et
 *   heures pour un coach) ;
 * - Opérations : gestion des adhérents, de la relation client, des coachs et des cours ;
 * - Paramètres : configuration de la salle (une entrée, sections en onglets).
 */
export function buildNavigation(
  role: GymRole,
  options: { prospects: number; ownCoachId: string | null },
): NavGroup[] {
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
      {
        href: "/adherents",
        label: t("nav.members"),
        icon: "members",
        ...(options.prospects > 0 ? { badge: options.prospects } : {}),
      },
    ]),
    ...when(manager, [
      { href: "/crm", label: t("nav.crm"), icon: "crm" },
      { href: "/segments", label: t("nav.segments"), icon: "segments" },
      { href: "/emailing", label: t("nav.emailing"), icon: "emailing" },
      { href: "/messages", label: t("nav.messages"), icon: "messages" },
      { href: "/coachs", label: t("nav.coaches"), icon: "coaches" },
      { href: "/planning/modeles", label: t("nav.templates"), icon: "templates" },
    ]),
  ];

  const settings: NavItem[] = when(manager, [
    { href: "/parametres", label: t("nav.settings"), icon: "settings" },
  ]);

  return [
    { label: t("nav.groupDaily"), items: daily },
    { label: t("nav.groupOperations"), items: operations },
    { label: t("nav.groupSettings"), items: settings },
  ].filter((group) => group.items.length > 0);
}
