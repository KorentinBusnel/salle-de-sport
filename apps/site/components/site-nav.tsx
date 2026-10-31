"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/button";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/cn";
import { useActiveSection } from "@/lib/use-active-section";

type NavLink = { id: string; label: string };

/** Entrée annoncée mais pas encore disponible : texte et pastille, sans lien. */
type SoonItem = { label: string; badge: string };

type Props = {
  brand: string;
  links: NavLink[];
  soon?: SoonItem[];
  cta: { id: string; label: string };
  labels: { nav: string; home: string; open: string; close: string };
};

function SoonBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">
      {children}
    </span>
  );
}

// Écart entre deux liens du menu mobile, et retard maximal de la cascade (skill B7).
const STAGGER_MS = 60;
const STAGGER_MAX_MS = 400;

/**
 * Barre flottante (skill B7) : pilule translucide sur flou, section courante signalée sur la
 * page d'accueil, entrées à venir avec une pastille « Bientôt » (sans lien), menu mobile plein
 * écran dont les liens arrivent en cascade.
 */
export function SiteNav({ brand, links, soon = [], cta, labels }: Props) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [open, setOpen] = useState(false);
  // Section courante, sur la page d'accueil seulement (lib/use-active-section.ts). Le bouton
  // vise le champ du hero : il n'est pas suivi.
  const current = useActiveSection(
    links.map((link) => link.id),
    onHome,
  );

  // Menu ouvert : Échap le ferme, la page derrière ne défile plus.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const href = (id: string) => (onHome ? `#${id}` : `/#${id}`);
  const isCurrent = (id: string) => current === id;

  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav
        aria-label={labels.nav}
        className="flex items-center gap-1 rounded-full bg-card/70 p-1 shadow-border backdrop-blur-md"
      >
        <Link
          href="/"
          aria-label={labels.home}
          onClick={() => setOpen(false)}
          className="flex min-h-10 items-center gap-2 rounded-full px-2 text-base font-semibold"
        >
          <BrandMark className="size-7" />
          <span aria-hidden="true">{brand}</span>
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={href(link.id)}
                aria-current={isCurrent(link.id) ? "location" : undefined}
                className={cn(
                  "flex min-h-10 items-center rounded-full px-3 text-sm font-medium transition-colors duration-300 ease-base",
                  isCurrent(link.id)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </a>
            </li>
          ))}
          {soon.map((item) => (
            <li
              key={item.label}
              className="flex min-h-10 items-center gap-2 px-3 text-sm font-medium text-muted-foreground"
            >
              {item.label}
              <SoonBadge>{item.badge}</SoonBadge>
            </li>
          ))}
        </ul>
        <a
          href={href(cta.id)}
          aria-current={isCurrent(cta.id) ? "location" : undefined}
          className={cn(buttonClasses("primary", "small"), "ml-2")}
        >
          {cta.label}
        </a>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="menu-mobile"
          aria-label={open ? labels.close : labels.open}
          onClick={() => setOpen((value) => !value)}
          className="relative flex size-10 items-center justify-center rounded-full transition-colors duration-300 ease-base hover:bg-secondary lg:hidden"
        >
          {/* Deux traits qui se croisent : l'icône se transforme au lieu de changer d'un coup. */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute h-0.5 w-4 rounded-full bg-current transition-transform duration-500 ease-base",
              open ? "rotate-45" : "-translate-y-1",
            )}
          />
          <span
            aria-hidden="true"
            className={cn(
              "absolute h-0.5 w-4 rounded-full bg-current transition-transform duration-500 ease-base",
              open ? "-rotate-45" : "translate-y-1",
            )}
          />
        </button>
      </nav>

      <div
        id="menu-mobile"
        inert={!open}
        className={cn(
          "fixed inset-0 -z-10 flex flex-col bg-card/90 px-6 pt-24 pb-12 backdrop-blur-xl transition-opacity duration-300 ease-base lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ul className="flex flex-col gap-2">
          {[
            ...links.map((link) => ({ kind: "link" as const, ...link })),
            ...soon.map((item) => ({ kind: "soon" as const, id: item.label, ...item })),
            { kind: "link" as const, ...cta },
          ].map((entry, index) => (
            <li
              key={entry.id}
              style={{
                transitionDelay: open ? `${Math.min(index * STAGGER_MS, STAGGER_MAX_MS)}ms` : "0ms",
              }}
              className={cn(
                "transition-[opacity,translate] duration-500 ease-base",
                open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
              )}
            >
              {entry.kind === "soon" ? (
                <span className="flex min-h-12 items-center gap-3 text-3xl font-semibold tracking-tight text-muted-foreground">
                  {entry.label}
                  <SoonBadge>{entry.badge}</SoonBadge>
                </span>
              ) : (
                <a
                  href={href(entry.id)}
                  aria-current={isCurrent(entry.id) ? "location" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-12 items-center text-3xl font-semibold tracking-tight transition-colors duration-300 ease-base",
                    isCurrent(entry.id) ? "text-primary" : "text-foreground",
                  )}
                >
                  {entry.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
