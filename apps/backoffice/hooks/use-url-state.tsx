"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useTransition } from "react";
import { cn } from "@/lib/utils";

type UrlState = {
  params: URLSearchParams;
  set: (
    changes: Record<string, string | null | undefined>,
    options?: { keepPage?: boolean },
  ) => void;
  /** Remplace toute la requête (filtres à valeurs multiples). */
  replaceQuery: (query: string) => void;
  pending: boolean;
};

const Shared = createContext<UrlState | null>(null);

function useOwnUrlState(): UrlState {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = useCallback(
    (changes: Record<string, string | null | undefined>, options?: { keepPage?: boolean }) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      }
      // Un filtre qui change ramène à la première page.
      if (!options?.keepPage && !("page" in changes)) next.delete("page");
      const query = next.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  const replaceQuery = useCallback(
    (query: string) =>
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }),
    [pathname, router],
  );

  return { params: new URLSearchParams(params.toString()), set, replaceQuery, pending };
}

/**
 * Filtres et recherches portés par l'URL, appliqués sans rechargement : router.replace dans
 * une transition ; `pending` sert à griser le contenu périmé (data-pending) au lieu
 * d'afficher un squelette plein écran. Sous `UrlStateProvider`, tous les filtres d'une page
 * partagent la même attente (`PendingRegion`).
 */
export function useUrlState(): UrlState {
  const shared = useContext(Shared);
  const own = useOwnUrlState();
  return shared ?? own;
}

export function UrlStateProvider({ children }: { children: ReactNode }) {
  const state = useOwnUrlState();
  return <Shared.Provider value={state}>{children}</Shared.Provider>;
}

/** Contenu grisé pendant qu'un filtre de la page s'applique. */
export function PendingRegion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  const { pending } = useUrlState();
  return (
    <div
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
      className={cn("transition-opacity duration-150 data-pending:opacity-60", className)}
    >
      {children}
    </div>
  );
}
