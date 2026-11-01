"use client";

import { type ReactNode, useRef } from "react";
import { useActiveTabInView } from "@/hooks/use-active-tab-in-view";

/**
 * Barre d'onglets rendue côté serveur (liens `aria-current="page"`) : au téléphone, l'onglet
 * courant est amené à l'écran, comme dans les Paramètres et l'Emailing.
 */
export function TabScroller({
  label,
  active,
  className,
  children,
}: {
  label: string;
  /** Onglet courant : la barre se recale quand il change. */
  active: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  const nav = useRef<HTMLElement>(null);
  useActiveTabInView(nav, active);
  return (
    <nav ref={nav} aria-label={label} className={className}>
      {children}
    </nav>
  );
}
