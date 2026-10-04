import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";

/** Squelette affiché pendant le chargement d'une page de l'espace équipe. */
export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label={t("ui.loading")}>
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
