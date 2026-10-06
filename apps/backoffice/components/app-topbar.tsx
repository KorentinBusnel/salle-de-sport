import { AppBreadcrumb, type Crumb } from "@/components/app-breadcrumb";
import { CommandPalette } from "@/components/command-palette";
import { NewMenu, type NewMenuItem } from "@/components/new-menu";
import type { PaletteEntry } from "@/lib/palette";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Barre du haut : bouton de la barre latérale, fil d'Ariane, champ unique « rechercher ou
 * demander » (⌘K, pages, réglages et actions pour tous les rôles) et « + Nouveau ».
 */
export function AppTopbar({
  crumbs,
  search,
  assistant,
  create,
  palette,
  userId,
}: {
  crumbs: Crumb[];
  search: boolean;
  assistant: boolean;
  create: NewMenuItem[];
  palette: PaletteEntry[];
  userId: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 rounded-t-xl border-b bg-card/90 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1.5" />
      <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
      <AppBreadcrumb crumbs={crumbs} />
      <div className="flex min-w-0 flex-1 justify-center">
        <CommandPalette members={search} assistant={assistant} entries={palette} userId={userId} />
      </div>
      <NewMenu items={create} />
    </header>
  );
}
