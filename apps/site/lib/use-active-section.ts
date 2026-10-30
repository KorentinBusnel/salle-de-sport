"use client";

import { useEffect, useState } from "react";

/**
 * Section courante d'une page : la dernière, dans l'ordre donné, dont le haut a passé la ligne de
 * lecture (`line`, part de la hauteur de l'écran), ou la dernière une fois en bas de page ; null
 * avant la première. Un seul écouteur de défilement limité par requestAnimationFrame (skill B7) :
 * plus fiable qu'un IntersectionObserver sur une ligne de hauteur nulle, et l'entrée reste
 * allumée dans les sections intermédiaires.
 */
export function useActiveSection(ids: readonly string[], enabled = true, line = 0.4) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(" ");

  useEffect(() => {
    if (!enabled) return;
    const order = key.split(" ");
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      let current: string | null = null;
      for (const id of order) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && (atBottom || top <= window.innerHeight * line)) current = id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [key, enabled, line]);

  return enabled ? active : null;
}
