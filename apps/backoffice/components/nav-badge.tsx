import { SidebarMenuBadge } from "@/components/ui/sidebar";
import type { BadgeKey } from "@/lib/navigation";
import { t } from "@/lib/i18n";
import { getNavCounts } from "@/lib/nav-counts";

/**
 * Pastille de la barre latérale, chargée à part (sous Suspense) : la coque s'affiche sans
 * attendre les comptages.
 */
export async function NavBadge({ gymId, kind }: { gymId: string; kind: BadgeKey }) {
  const counts = await getNavCounts(gymId);
  const count = counts?.[kind] ?? 0;
  if (!count) return null;
  return (
    <SidebarMenuBadge
      className="bg-primary text-primary-foreground tabular-nums peer-data-active/menu-button:text-primary-foreground"
      aria-label={t("nav.badge", { count })}
    >
      {count}
    </SidebarMenuBadge>
  );
}
