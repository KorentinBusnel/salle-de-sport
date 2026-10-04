import { AskDialog } from "@/components/assistant/ask-dialog";
import { MemberSearch } from "@/components/member-search";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Barre du haut : bouton de la barre latérale, recherche d'adhérent (accueil et plus) et
 * « Demander… » à l'assistant (gérant, ⌘K).
 */
export function AppTopbar({ search, assistant }: { search: boolean; assistant: boolean }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-card/90 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1.5" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      {search ? <MemberSearch /> : null}
      {assistant ? <AskDialog /> : null}
    </header>
  );
}
