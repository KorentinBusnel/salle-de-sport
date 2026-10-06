import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { brand, seo } from "@/content/landing";
import { assertReadyForProduction } from "@/lib/launch-guard";
import { siteUrl } from "@/lib/site";
import { colors } from "@/lib/tokens";
import "./globals.css";

// Polices auto-hébergées par next/font (aucun appel à Google Fonts depuis le navigateur), en
// version variable : un fichier par famille et par style. Geist Mono (libellés) n'est pas
// préchargée pour laisser la priorité à la photo du hero.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", preload: false });

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: seo.title, template: `%s · ${brand.name}` },
  description: seo.description,
  applicationName: brand.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: brand.name,
    title: seo.title,
    description: seo.description,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: seo.title, description: seo.description },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: colors.background,
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  assertReadyForProduction();
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${geist.variable} ${geistMono.variable} font-sans`}
    >
      <body className="bg-background text-foreground">
        {children}
        {/* Script servi par Vercel uniquement (/_vercel/insights) : absent en local. */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  );
}
