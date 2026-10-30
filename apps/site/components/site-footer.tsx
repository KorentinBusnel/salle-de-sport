import Link from "next/link";
import { ChalkMark } from "@/components/chalk-mark";
import { CONTAINER } from "@/components/section-heading";
import { t, type MessageKey } from "@/lib/i18n";
import { BRAND, SECTIONS } from "@/lib/site";

const COLUMNS: { title: MessageKey; links: { href: string; label: MessageKey }[] }[] = [
  {
    title: "footer.product",
    links: [
      { href: `/#${SECTIONS.features}`, label: "nav.features" },
      { href: `/#${SECTIONS.how}`, label: "nav.how" },
      { href: `/#${SECTIONS.faq}`, label: "nav.faq" },
    ],
  },
  {
    title: "footer.legal",
    links: [
      { href: `/#${SECTIONS.start}`, label: "nav.cta" },
      { href: "/confidentialite", label: "footer.privacy" },
      { href: "/mentions-legales", label: "footer.legalNotice" },
    ],
  },
];

export function SiteFooter({ year }: { year: number }) {
  return (
    <footer className="border-t border-border">
      <div className={`${CONTAINER} grid grid-cols-2 gap-10 py-12 sm:grid-cols-4`}>
        <div className="col-span-2">
          <Link href="/" className="flex w-fit items-center gap-2 text-base font-semibold">
            <ChalkMark className="size-7" />
            {BRAND.name}
          </Link>
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">{t("footer.tagline")}</p>
          <p className="mt-6 text-sm text-muted-foreground tabular-nums">
            {t("footer.copyright", { year })}
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={t(column.title)}>
            <p className="text-sm font-semibold">{t(column.title)}</p>
            <ul className="mt-4 space-y-1">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex min-h-10 items-center text-sm text-muted-foreground transition-colors duration-300 ease-base hover:text-foreground"
                  >
                    {t(link.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
