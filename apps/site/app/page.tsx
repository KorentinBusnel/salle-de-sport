import type { Metadata } from "next";
import { Benefits } from "@/components/sections/benefits";
import { Hero } from "@/components/sections/hero";
import { SITE_URL } from "@/lib/env";
import { t } from "@/lib/i18n";
import { SEO_FEATURES } from "@/lib/llms";
import { BRAND } from "@/lib/site";

// Page statique relue toutes les heures : le compteur de salles du hero se met à jour.
export const revalidate = 3600;

export const metadata: Metadata = { alternates: { canonical: "/" } };

/**
 * Données structurées (schema.org) pour les moteurs et les assistants IA : l'éditeur, le site et
 * le logiciel, décrit par ce qu'il fait déjà (aucun prix, aucune note inventée).
 */
function structuredData() {
  const organization = `${SITE_URL}/#organisation`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organization,
        name: BRAND.name,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/apple-icon.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#site`,
        url: `${SITE_URL}/`,
        name: BRAND.name,
        inLanguage: "fr-FR",
        publisher: { "@id": organization },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#logiciel`,
        name: BRAND.name,
        url: `${SITE_URL}/`,
        description: t("meta.description"),
        applicationCategory: "BusinessApplication",
        applicationSubCategory: t("meta.category"),
        operatingSystem: "Web",
        inLanguage: "fr-FR",
        featureList: SEO_FEATURES.map((key) => t(key)),
        publisher: { "@id": organization },
      },
    ],
  };
}

// Hero (dont « Demander une démo »), fonctionnalités.
export default function Home() {
  return (
    <main id="contenu">
      <script
        type="application/ld+json"
        // JSON sérialisé côté serveur ; « < » échappé pour ne jamais fermer la balise.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c"),
        }}
      />
      <Hero />
      <Benefits />
    </main>
  );
}
