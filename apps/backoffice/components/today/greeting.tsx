import type { TeamContext } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getActionCount } from "@/lib/today";

/** Titre de l'accueil avec le nombre d'actions en attente (arrive avec les données). */
export async function Greeting({ context, name }: { context: TeamContext; name: string }) {
  const count = await getActionCount(context);
  return t("today.greeting", { name, actions: t("today.actions", { count }) });
}
