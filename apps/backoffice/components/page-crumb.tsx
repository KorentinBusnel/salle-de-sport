"use client";

import { usePathname } from "next/navigation";
import { createContext, use, useEffect, useState, type ReactNode } from "react";

/** Dernier maillon du fil d'Ariane, fourni par la page (nom d'un adhérent, date d'une séance…). */
export type PageCrumbValue = {
  label: string;
  /** Lien du maillon parent, s'il diffère de l'entrée de navigation (semaine de la séance). */
  parentHref?: string | undefined;
};

type Stored = PageCrumbValue & { pathname: string };

const PageCrumbContext = createContext<{
  crumb: Stored | null;
  setCrumb: (crumb: Stored | null) => void;
} | null>(null);

export function PageCrumbProvider({ children }: { children: ReactNode }) {
  const [crumb, setCrumb] = useState<Stored | null>(null);
  return <PageCrumbContext value={{ crumb, setCrumb }}>{children}</PageCrumbContext>;
}

/** Maillon de la page courante, ignoré une fois la page quittée. */
export function usePageCrumb(): PageCrumbValue | null {
  const pathname = usePathname();
  const crumb = use(PageCrumbContext)?.crumb;
  return crumb && crumb.pathname === pathname ? crumb : null;
}

/** À rendre dans une page de détail : donne son titre au fil d'Ariane de la barre du haut. */
export function PageCrumb({ label, parentHref }: PageCrumbValue) {
  const pathname = usePathname();
  const setCrumb = use(PageCrumbContext)?.setCrumb;
  useEffect(() => {
    setCrumb?.({ label, parentHref, pathname });
    return () => setCrumb?.(null);
  }, [setCrumb, label, parentHref, pathname]);
  return null;
}
