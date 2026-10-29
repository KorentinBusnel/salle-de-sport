import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { INDEXABLE, SITE_URL } from "@/lib/env";
import { t } from "@/lib/i18n";
import { BRAND, SECTIONS } from "@/lib/site";
import "./globals.css";

// Une seule police (skill B1) ; graisses jusqu'au semi-gras.
const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist",
});

// Année du pied de page, figée au build (page statique).
const YEAR = new Date().getFullYear();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: t("meta.title"), template: `%s · ${BRAND.name}` },
  description: t("meta.description"),
  applicationName: BRAND.name,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: BRAND.name,
    title: t("meta.title"),
    description: t("meta.description"),
  },
  twitter: { card: "summary_large_image" },
  // Indexé seulement en production : mentions légales à compléter avant (lib/site.ts).
  robots: INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={geist.variable}>
      <body>
        <a
          href="#contenu"
          className="sr-only rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60]"
        >
          {t("nav.skip")}
        </a>
        <SiteNav
          brand={BRAND.name}
          links={[
            { id: SECTIONS.adaptable, label: t("nav.adaptable") },
            { id: SECTIONS.features, label: t("nav.features") },
            { id: SECTIONS.how, label: t("nav.how") },
            { id: SECTIONS.faq, label: t("nav.faq") },
          ]}
          cta={{ id: SECTIONS.start, label: t("nav.cta") }}
          labels={{
            nav: t("nav.label"),
            home: t("nav.home"),
            open: t("nav.openMenu"),
            close: t("nav.closeMenu"),
          }}
        />
        {children}
        <SiteFooter year={YEAR} />
      </body>
    </html>
  );
}
