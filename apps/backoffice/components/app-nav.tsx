"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string };

/** Navigation principale ; l'entrée active est celle dont le chemin est le plus long préfixe. */
export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const active = items
    .filter((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item === active ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            item === active && "bg-accent font-medium text-accent-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
