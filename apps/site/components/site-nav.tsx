"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/button";
import { ChalkMark } from "@/components/chalk-mark";
import { cn } from "@/lib/cn";

type NavLink = { id: string; label: string };

type Props = {
  brand: string;
  links: NavLink[];
  cta: { id: string; label: string };
  labels: { nav: string; home: string; open: string; close: string };
};

// Écart entre deux liens du menu mobile, et retard maximal de la cascade (skill B7).
const STAGGER_MS = 60;
const STAGGER_MAX_MS = 400;

/**
 * Barre flottante (skill B7) : pilule translucide sur flou, section courante signalée sur la
 * page d'accueil, menu mobile plein écran dont les liens arrivent en cascade.
 */
export function SiteNav({ brand, links, cta, labels }: Props) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  // Section courante : celle qui traverse le milieu de l'écran.
  useEffect(() => {
    if (!onHome) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) setCurrent(id);
          else setCurrent((value) => (value === id ? null : value));
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    for (const { id } of [...links, cta]) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [onHome, links, cta]);

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
  const isCurrent = (id: string) => onHome && current === id;

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
          <ChalkMark className="size-7" />
          <span aria-hidden="true">{brand}</span>
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
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
          className="relative flex size-10 items-center justify-center rounded-full transition-colors duration-300 ease-base hover:bg-secondary md:hidden"
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
          "fixed inset-0 -z-10 flex flex-col bg-card/90 px-6 pt-24 pb-12 backdrop-blur-xl transition-opacity duration-300 ease-base md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ul className="flex flex-col gap-2">
          {[...links, cta].map((link, index) => (
            <li
              key={link.id}
              style={{
                transitionDelay: open ? `${Math.min(index * STAGGER_MS, STAGGER_MAX_MS)}ms` : "0ms",
              }}
              className={cn(
                "transition-[opacity,translate] duration-500 ease-base",
                open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
              )}
            >
              <a
                href={href(link.id)}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center text-3xl font-semibold tracking-tight"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
