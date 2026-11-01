"use client";

import { type ComponentProps, useEffect, useRef } from "react";

/**
 * Bande des jours de la vue jour : au téléphone, elle défile pour montrer le jour choisi
 * (`aria-current="date"`), sinon hors écran. Seule la bande défile, jamais la page.
 */
export function DayStrip({
  selectedKey,
  children,
  ...props
}: ComponentProps<"nav"> & { selectedKey: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const strip = ref.current;
    const day = strip?.querySelector<HTMLElement>('[aria-current="date"]');
    if (!strip || !day) return;
    const box = strip.getBoundingClientRect();
    const rect = day.getBoundingClientRect();
    strip.scrollLeft += rect.left - box.left - (box.width - rect.width) / 2;
  }, [selectedKey]);
  return (
    <nav ref={ref} {...props}>
      {children}
    </nav>
  );
}
