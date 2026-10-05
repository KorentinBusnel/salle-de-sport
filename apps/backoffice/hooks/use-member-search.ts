"use client";

import type { MemberStatus } from "@salle/shared";
import { useEffect, useState } from "react";

export type MemberHit = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: MemberStatus;
};

export const MEMBER_SEARCH_MIN = 2;

/**
 * Recherche d'adhérents au fil de la frappe (nom complet sans accents, téléphone) : attente de
 * 180 ms, requête précédente annulée, résultats vidés sous 2 caractères.
 */
export function useMemberSearch(query: string, { enabled = true }: { enabled?: boolean } = {}) {
  const term = query.trim();
  const [found, setFound] = useState<{ term: string; hits: MemberHit[] }>({ term: "", hits: [] });
  const [loading, setLoading] = useState(false);
  const short = term.length < MEMBER_SEARCH_MIN;

  useEffect(() => {
    if (!enabled || short) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/adherents/recherche?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as { members: MemberHit[] };
          setFound({ term, hits: data.members });
        }
      } catch {
        // Requête annulée par une frappe plus récente.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [enabled, short, term]);

  return {
    hits: enabled && !short ? found.hits : [],
    /** Les résultats affichés correspondent encore à une frappe précédente. */
    stale: found.term !== term,
    loading: enabled && !short && loading,
    short,
  };
}
