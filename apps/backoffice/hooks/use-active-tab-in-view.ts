"use client";

import { type RefObject, useEffect } from "react";

/**
 * Barre d'onglets qui défile à l'horizontale (téléphone) : amène l'onglet courant
 * (`aria-current="page"`) à l'écran au montage et à chaque changement d'onglet. Seul le
 * conteneur défile (équivalent de `scrollIntoView({ inline: "nearest" })`), jamais la page :
 * une page rouverte plus bas ne remonte pas d'un coup.
 */
export function useActiveTabInView(scroller: RefObject<HTMLElement | null>, active: unknown) {
  useEffect(() => {
    const container = scroller.current;
    if (!container || container.scrollWidth <= container.clientWidth) return;
    const tab = container.querySelector<HTMLElement>('[aria-current="page"]');
    if (!tab) return;
    const box = container.getBoundingClientRect();
    const rect = tab.getBoundingClientRect();
    if (rect.left < box.left) container.scrollBy({ left: rect.left - box.left });
    else if (rect.right > box.right) container.scrollBy({ left: rect.right - box.right });
  }, [scroller, active]);
}
