import Link from "next/link";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/emailing", key: "emailing.tab.campaigns" },
  { href: "/emailing/modeles", key: "emailing.tab.templates" },
  { href: "/emailing/automatisations", key: "emailing.tab.automations" },
] as const;

/** Onglets de l'emailing : campagnes, modèles, automatisations. */
export function EmailingNav({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label={t("emailing.title")} className="flex w-fit gap-1 rounded-xl bg-muted p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === current ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm transition-colors pointer-coarse:py-2.5",
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
