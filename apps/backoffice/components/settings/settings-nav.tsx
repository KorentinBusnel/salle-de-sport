import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Navigation verticale des Paramètres : une section par ligne, avec une phrase d'aide. Sur
 * mobile, elle défile à l'horizontale au-dessus du contenu.
 */
export function SettingsNav({
  label,
  sections,
}: {
  label: string;
  sections: { href: string; label: string; hint: string; current: boolean }[];
}) {
  return (
    <nav
      aria-label={label}
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-20 lg:mx-0 lg:grid lg:overflow-visible lg:px-0"
    >
      {sections.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          aria-current={section.current ? "page" : undefined}
          className={cn(
            "grid shrink-0 gap-0.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
            section.current
              ? "bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_var(--color-brand-100)]"
              : "text-foreground hover:bg-muted",
          )}
        >
          <span className="font-medium">{section.label}</span>
          <span
            className={cn(
              "hidden text-xs lg:block",
              section.current ? "text-accent-foreground/80" : "text-muted-foreground",
            )}
          >
            {section.hint}
          </span>
        </Link>
      ))}
    </nav>
  );
}
