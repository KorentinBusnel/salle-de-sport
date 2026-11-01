import type { BuiltinMemberViewId } from "@salle/shared";
import type { MessageKey } from "@/lib/i18n";

/** Libellés des vues intégrées des adhérents : les onglets de statut, par leurs clés d'origine. */
export const BUILTIN_VIEW_LABELS: Record<BuiltinMemberViewId, MessageKey> = {
  "a-activer": "members.filterProspects",
  actifs: "members.filterActive",
  suspendus: "members.filterSuspended",
  resilies: "members.filterCancelled",
  tous: "members.allStatuses",
};
