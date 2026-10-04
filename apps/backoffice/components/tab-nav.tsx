import Link from "next/link";
import { cn } from "@/lib/utils";

/** Sous-navigation en onglets (liens) : section courante marquée pour les lecteurs d'écran. */
export function TabNav({
  label,
  tabs,
}: {
  label: string;
  tabs: { href: string; label: string; current: boolean }[];
}) {
  return (
    <nav
      aria-label={label}
      className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.current ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors pointer-coarse:py-2.5",
            tab.current
              ? "bg-card font-medium text-foreground shadow-border"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
