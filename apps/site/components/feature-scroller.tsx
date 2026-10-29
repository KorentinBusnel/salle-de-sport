"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useActiveSection } from "@/lib/use-active-section";

// Hauteur d'une entrée de la liste (h-12) : le trait glisse d'autant par entrée.
const ITEM_HEIGHT = 48;

/**
 * Dérouleur des fonctionnalités : à partir de `lg`, une liste collante à gauche suit le panneau
 * lu à droite (élément courant en noir, les autres estompés, un trait qui glisse). Les panneaux
 * restent lisibles empilés sur mobile et sans JavaScript.
 */
export function FeatureScroller({
  label,
  items,
  children,
}: {
  label: string;
  items: { id: string; label: string }[];
  children: ReactNode;
}) {
  const active = useActiveSection(
    items.map((item) => item.id),
    true,
    0.5,
  );
  const index = Math.max(
    0,
    items.findIndex((item) => item.id === active),
  );

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-16">
      <nav aria-label={label} className="hidden lg:block">
        <div className="sticky top-32 rounded-2xl bg-card py-6 shadow-border">
          <ol className="relative">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-px bg-border" />
            <span
              aria-hidden="true"
              className="absolute top-0 left-0 h-12 w-0.5 rounded-full bg-primary transition-transform duration-500 ease-base"
              style={{ transform: `translateY(${index * ITEM_HEIGHT}px)` }}
            />
            {items.map((item, position) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={position === index ? "true" : undefined}
                  className={cn(
                    "flex h-12 items-center px-6 text-lg font-medium tracking-tight transition-colors duration-300 ease-base xl:text-xl",
                    position === index
                      ? "text-foreground"
                      : "text-neutral-400 hover:text-muted-foreground",
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>
      <div className="lg:col-span-2">{children}</div>
    </div>
  );
}
