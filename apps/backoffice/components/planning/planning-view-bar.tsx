"use client";

import type { PlanningLayout } from "@salle/shared";
import { type ComponentProps, useSyncExternalStore } from "react";
import { ViewBar, type ViewMeta } from "@/components/views/view-bar";

/** Même seuil que la page : grille semaine dès `lg`, liste du jour en dessous. */
const WIDE = "(min-width: 64rem)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Barre de vues du planning. Sans `?vue=`, l'affichage suit l'écran (semaine sur grand écran,
 * jour sinon) : l'onglet mis en avant est celui de l'affichage réellement montré, connu une fois
 * la page chargée dans le navigateur.
 */
export function PlanningViewBar<S>({
  autoDay,
  ...props
}: ComponentProps<typeof ViewBar<PlanningLayout, S>> & {
  /** Affichage automatique : la vue « Jour » à mettre en avant sous `lg` (null : vue choisie). */
  autoDay: ViewMeta | null;
}) {
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => null,
  );
  if (!autoDay) return <ViewBar {...props} />;
  const day = wide === false;
  return (
    <ViewBar
      {...props}
      activeTab={wide === null ? null : day ? autoDay.id : props.current.id}
      current={day ? autoDay : props.current}
      layout={day ? "day" : props.layout}
    />
  );
}
