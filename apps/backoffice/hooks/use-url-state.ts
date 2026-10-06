"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * Filtres et recherches portés par l'URL, appliqués sans rechargement : router.replace dans
 * une transition ; `pending` sert à griser le contenu périmé (data-pending) au lieu
 * d'afficher un squelette plein écran.
 */
export function useUrlState() {
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

  return { params, set, pending };
}
