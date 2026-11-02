"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * Cadre défilant de la grille semaine. À l'ouverture et à chaque changement de semaine
 * (`scrollKey`), il descend jusqu'au repère `[data-scroll-target]` posé par la page, juste sous
 * les en-têtes collants (`[data-sticky-header]`) : les soirées ne restent pas hors du cadre.
 */
export function WeekScroll({
  scrollKey,
  className,
  children,
}: {
  scrollKey: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const area = ref.current;
    const target = area?.querySelector<HTMLElement>("[data-scroll-target]");
    if (!area || !target) return;
    const header = area.querySelector<HTMLElement>("[data-sticky-header]");
    const top =
      target.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop;
    area.scrollTop = Math.max(0, top - (header?.offsetHeight ?? 0));
  }, [scrollKey]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
