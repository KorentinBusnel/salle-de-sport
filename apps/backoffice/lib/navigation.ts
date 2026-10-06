import {
  DEFAULT_NAV_BADGES,
  type GymRole,
  layoutRole,
  NAV_BADGES,
  type NavBadge,
} from "@salle/shared";
import type { NavGroup, NavItem } from "@/components/app-sidebar";
import { isFrontDeskRole, isManagerRole } from "@/lib/auth-roles";
import { t } from "@/lib/i18n";

export type Navigation = { groups: NavGroup[]; footer: NavItem[] };

/** Pages rangées sous l'entrée d'une autre (onglets Segments et Messages de l'emailing). */
export const NAV_ALIASES: Record<string, string> = {
  "/segments": "/emailing",
  "/messages": "/emailing",
};

/** Entrée active : celle dont le chemin est le plus long préfixe (« Modèles » ≠ « Planning »). */
export function activeHref(pathname: string, hrefs: string[]): string | undefined {
  const alias = Object.entries(NAV_ALIASES).find(
    ([from]) => pathname === from || pathname.startsWith(`${from}/`),
  );
  const path = alias ? `${alias[1]}${pathname.slice(alias[0].length)}` : pathname;
  return hrefs
    .filter((href) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];
}

/** Compteurs possibles d'une pastille (fonction SQL nav_counts). */
export const BADGE_KEYS = NAV_BADGES;
export type BadgeKey = NavBadge;

/** Entrée qui porte chaque pastille. */
export const BADGE_HREF: Record<BadgeKey, string> = {
  prospects: "/adherents",
  unanswered: "/emailing",
  trials_to_call: "/crm",
  unpaid: "/",
};

/**
 * Barre latérale par rôle :
 * - Quotidien : ce qu'on ouvre chaque jour (accueil, Hub, planning, indicateurs ; fiche et
 *   heures pour un coach) ;
 * - Opérations : faire tourner la salle (cours récurrents, coachs, paiements) ;
 * - Clients : adhérents, pipeline et emailing ;
 * - Marketplace (gérant) : catalogue, commandes, devis, et l'espace Plateforme pour un admin ;
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

  const operations: NavItem[] = when(manager, [
    { href: "/planning/modeles", label: t("nav.templates"), icon: "templates" },
    { href: "/coachs", label: t("nav.coaches"), icon: "coaches" },
    { href: "/paiements", label: t("nav.payments"), icon: "payments" },
  ]);

  const clients: NavItem[] = [
    ...when(frontDesk, [{ href: "/adherents", label: t("nav.members"), icon: "members" }]),
    ...when(manager, [
      { href: "/crm", label: t("nav.crm"), icon: "crm" },
      // Une seule entrée : campagnes, modèles, automatisations, segments et messages en onglets.
      { href: "/emailing", label: t("nav.emailing"), icon: "emailing" },
    ]),
  ];

  const marketplace: NavItem[] = [
    ...when(manager, [
      { href: "/marketplace", label: t("nav.catalog"), icon: "marketplace" },
      { href: "/marketplace/commandes", label: t("nav.orders"), icon: "orders" },
      { href: "/marketplace/devis", label: t("nav.quotes"), icon: "quotes" },
    ]),
    // Catalogue commun : administrateurs de la plateforme (rôle admin).
    ...when(role === "admin", [
      { href: "/plateforme", label: t("nav.platform"), icon: "platform" },
    ]),
  ];

  // Pastilles : sur l'entrée qui les porte, si elle est visible pour ce rôle.
  const enabled = new Set(options.badges ?? DEFAULT_NAV_BADGES[layoutRole(role)]);
  const withBadges = (items: NavItem[]) =>
    items.map((item) => {
      const badge = BADGE_KEYS.find((key) => enabled.has(key) && BADGE_HREF[key] === item.href);
      return badge ? { ...item, badge } : item;
    });

  return {
    groups: [
      { label: t("nav.groupDaily"), items: withBadges(daily) },
      { label: t("nav.groupOperations"), items: withBadges(operations) },
      { label: t("nav.groupClients"), items: withBadges(clients) },
      { label: t("nav.groupMarketplace"), items: withBadges(marketplace) },
    ].filter((group) => group.items.length > 0),
    footer: [
      ...when(manager, [{ href: "/parametres", label: t("nav.settings"), icon: "settings" }]),
    ],
  };
}
