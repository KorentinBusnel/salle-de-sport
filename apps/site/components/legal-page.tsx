import { ArrowLeftIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";

/** Page de texte (mentions légales, confidentialité) avec son chemin de retour. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="contenu" className="pt-24 pb-20">
      <div className="mx-auto w-full max-w-3xl px-4 pt-12 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors duration-300 ease-base hover:text-foreground"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          {t("legal.back")}
        </Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-10 space-y-10">{children}</div>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-2 text-base text-muted-foreground">{children}</div>
    </section>
  );
}

/** Valeur des mentions légales, ou « à compléter » tant qu'elle manque (lib/site.ts). */
export function LegalValue({ value }: { value: string | null }) {
  return value ?? <span className="font-medium text-warning">{t("legal.toComplete")}</span>;
}
