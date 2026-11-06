"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const INTERVAL = 60_000;
const DEBOUNCE = 1_500;

/**
 * Données vivantes de l'accueil : rafraîchit la page (sans squelette, l'ancien rendu reste
 * affiché) au retour sur l'onglet et peu après chaque changement des séances de la salle
 * (Realtime : places, annulations). L'intervalle de 60 s ne tourne que tant qu'une séance est en
 * cours ou commence dans l'heure (`pollUntil`) ; salle fermée, la page ne relit rien. `resumeAt`
 * : instant où la séance suivante entre dans cette fenêtre, pour reprendre sans attendre un
 * retour sur l'onglet.
 */
export function LiveRefresh({
  gymId,
  pollUntil,
  resumeAt,
}: {
  gymId: string;
  pollUntil: string | null;
  resumeAt: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    let debounce: number | undefined;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      last = Date.now();
      startTransition(() => router.refresh());
    };
    const deadline = pollUntil ? Date.parse(pollUntil) : 0;
    const interval = window.setInterval(() => {
      if (Date.now() >= deadline) {
        window.clearInterval(interval);
        return;
      }
      refresh();
    }, INTERVAL);
    // Reprise à l'approche de la séance suivante (le rendu suivant pose un nouveau pollUntil).
    const resume = resumeAt
      ? window.setTimeout(refresh, Math.max(0, Date.parse(resumeAt) - Date.now()))
      : undefined;
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
      window.clearTimeout(resume);
      window.clearTimeout(debounce);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [gymId, pollUntil, resumeAt, router]);

  return null;
}
