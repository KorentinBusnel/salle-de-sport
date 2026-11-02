import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { CONTAINER } from "@/components/section-heading";
import { t } from "@/lib/i18n";
import { BRAND } from "@/lib/site";

/**
 * Pied de page : marque, phrase, copyright, et les deux pages légales. Celles-ci sont affichées
 * sans lien pour l'instant (décision du gérant, BRIEF §12) : leurs mentions restent à compléter.
 */
export function SiteFooter({ year }: { year: number }) {
  return (
    <footer className="border-t border-border">
      <div
        className={`${CONTAINER} flex flex-col gap-8 py-12 sm:flex-row sm:items-end sm:justify-between`}
      >
        <div>
          <Link href="/" className="flex min-h-10 w-fit items-center gap-2 text-base font-semibold">
            <BrandMark className="size-7" />
            {BRAND.name}
          </Link>
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">{t("footer.tagline")}</p>
          <p className="mt-6 text-sm text-muted-foreground tabular-nums">
            {t("footer.copyright", { year })}
          </p>
        </div>
        <ul aria-label={t("footer.legal")} className="flex gap-6 text-sm text-muted-foreground">
          <li>{t("footer.privacy")}</li>
          <li>{t("footer.legalNotice")}</li>
        </ul>
      </div>
    </footer>
  );
}
