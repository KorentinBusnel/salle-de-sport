import Link from "next/link";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/marketplace", key: "marketplace.tab.catalog" },
  { href: "/marketplace/commandes", key: "marketplace.tab.orders" },
  { href: "/marketplace/devis", key: "marketplace.tab.quotes" },
] as const;

/** Onglets de la marketplace : catalogue, commandes, devis. */
export function MarketplaceNav({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav
      aria-label={t("marketplace.title")}
      className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === current ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors pointer-coarse:py-2.5",
            tab.href === current
              ? "bg-card font-medium text-foreground shadow-border"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}
