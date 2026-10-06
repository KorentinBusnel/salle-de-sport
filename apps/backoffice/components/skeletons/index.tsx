import type { CSSProperties, ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Squelettes des pages (loading.tsx) : même forme que la page chargée, pour que rien ne saute
 * à l'arrivée des données.
 */
export function PageSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t("ui.loading")}</span>
      {children}
    </div>
  );
}

export function HeaderSkeleton({ actions = 0, meta = true }: { actions?: number; meta?: boolean }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56" />
        {meta ? <Skeleton className="h-4 w-72 max-w-full" /> : null}
      </div>
      {actions ? (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-lg" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TabsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex w-fit max-w-full gap-1 rounded-xl bg-muted p-1">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-7 w-24 rounded-lg bg-card" />
      ))}
    </div>
  );
}

export function FiltersSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Skeleton className="h-9 w-64 max-w-full rounded-lg" />
      {Array.from({ length: count - 1 }, (_, i) => (
        <Skeleton key={i} className="h-9 w-36 rounded-lg" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-border">
      <div className="flex gap-4 border-b px-4 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className={cn("h-4", i === 0 ? "w-40" : "hidden w-24 sm:block")} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: columns - 1 }, (_, i) => (
            <Skeleton key={i} className="hidden h-4 w-24 sm:block" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({
  count = 4,
  className,
  height = "h-28",
}: {
  count?: number;
  className?: string;
  height?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={cn("rounded-xl", height)} />
      ))}
    </div>
  );
}

/** Colonne latérale (filtres, sections, conversations) et contenu principal. */
export function SplitSkeleton({ aside = "16rem", items = 6 }: { aside?: string; items?: number }) {
  return (
    <div
      className="grid items-start gap-6 lg:grid-cols-[var(--aside)_minmax(0,1fr)]"
      style={{ "--aside": aside } as CSSProperties}
    >
      <div className="grid gap-2">
        {Array.from({ length: items }, (_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
