import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { INDEXABLE, SITE_URL } from "@/lib/env";
import { t } from "@/lib/i18n";
import { BRAND, SECTIONS } from "@/lib/site";
import "./globals.css";

// Police du produit (packages/ui, fontFamily.sans), comme le back office ; une seule police.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
  // Indexé seulement en production ; aperçus riches autorisés (grande image, extrait complet).
  robots: INDEXABLE
    ? {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
      }
    : { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>
        <a
          href="#contenu"
          className="sr-only rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60]"
        >
          {t("nav.skip")}
        </a>
        <SiteNav
          brand={BRAND.name}
          links={[{ id: SECTIONS.features, label: t("nav.features") }]}
          soon={[{ label: t("nav.marketplace"), badge: t("nav.soon") }]}
          cta={{ id: SECTIONS.demo, label: t("nav.cta") }}
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
