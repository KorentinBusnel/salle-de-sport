"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const INTERVAL = 60_000;
const DEBOUNCE = 1_500;

/**
 * Données vivantes de l'accueil : rafraîchit la page (sans squelette, l'ancien rendu reste
 * affiché) toutes les 60 s quand l'onglet est visible, au retour sur l'onglet, et peu après
 * chaque changement des séances de la salle (Realtime : places, annulations).
 */
export function LiveRefresh({ gymId }: { gymId: string }) {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    let debounce: number | undefined;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      last = Date.now();
      startTransition(() => router.refresh());
    };
    const interval = window.setInterval(refresh, INTERVAL);
    const onVisible = () => {
      if (Date.now() - last >= INTERVAL) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    const supabase = createClient();
    const channel = supabase
      .channel(`accueil:${gymId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_sessions", filter: `gym_id=eq.${gymId}` },
        () => {
          window.clearTimeout(debounce);
          debounce = window.setTimeout(refresh, DEBOUNCE);
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [gymId, router]);

  return null;
}
