import Link from "next/link";
import { brand, footer } from "@/content/landing";
import { Wordmark } from "@/components/logo";

const linkClass =
  "inline-flex min-h-10 items-center rounded-md text-muted-foreground transition-colors hover:text-foreground";

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm">
        <Link
          href="/"
          aria-label={`${brand.name} — accueil`}
          className="rounded-lg text-foreground"
        >
          <Wordmark className="text-[22px]" />
        </Link>
        <nav aria-label="Pied de page">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs tracking-[0.04em] uppercase">
            <li>
              <a href={`mailto:${brand.contactEmail}`} className={linkClass}>
                {footer.contact}
              </a>
            </li>
            <li>
              <Link href="/mentions-legales" className={linkClass}>
                {footer.legal}
              </Link>
            </li>
            <li>
              <Link href="/confidentialite" className={linkClass}>
                {footer.privacy}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
