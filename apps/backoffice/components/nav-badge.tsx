import { SidebarMenuBadge } from "@/components/ui/sidebar";
import type { BadgeKey } from "@/lib/navigation";
import { t } from "@/lib/i18n";
import { getNavCounts } from "@/lib/nav-counts";

/**
 * Pastille de la barre latérale, chargée à part (sous Suspense) : la coque s'affiche sans
 * attendre les comptages. Le nombre seul ne dit rien hors de son contexte : un texte masqué
 * (lecteurs d'écran) et une infobulle disent ce qu'il compte (« 15 prospects à activer »).
 */
export async function NavBadge({ gymId, kind }: { gymId: string; kind: BadgeKey }) {
  const counts = await getNavCounts(gymId);
  const count = counts?.[kind] ?? 0;
  if (!count) return null;
  const label = t(`nav.badges.${kind}`, { count });
  return (
    <SidebarMenuBadge
      className="bg-primary text-primary-foreground tabular-nums peer-data-active/menu-button:text-primary-foreground"
      title={label}
    >
      <span aria-hidden>{count}</span>
      <span className="sr-only">{label}</span>
    </SidebarMenuBadge>
  );
}
