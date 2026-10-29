import type { Metadata } from "next";
import { ButtonLink } from "@/components/button";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("notFound.title") };

export default function NotFound() {
  return (
    <main id="contenu" className="flex min-h-dvh items-center pt-24 pb-20">
      <div className="mx-auto w-full max-w-hero px-4 text-center sm:px-6">
        <p className="text-sm font-semibold text-primary">{t("notFound.eyebrow")}</p>
        <h1 className="mt-4 text-hero text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("notFound.title")}
        </h1>
        <p className="mt-6 text-lg text-muted-foreground">{t("notFound.body")}</p>
        <ButtonLink href="/" className="mt-8">
          {t("notFound.back")}
        </ButtonLink>
      </div>
    </main>
  );
}
