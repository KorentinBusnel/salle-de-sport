import { brand, faq, pricing, seo } from "@/content/landing";

/**
 * Données structurées de la page (LANDING_BRIEF.md §4) : un seul graphe Organization, WebSite,
 * SoftwareApplication et FAQPage. La FAQ est celle affichée, mot pour mot. Aucune note ni avis :
 * rien n'est inventé (Google ne rend donc pas SoftwareApplication éligible aux résultats enrichis).
 */
export function buildJsonLd(base: URL) {
  const url = new URL("/", base).href;
  const organization = `${url}#organisation`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organization,
        name: brand.name,
        url,
        logo: new URL("/logo.png", base).href,
        email: brand.contactEmail,
      },
      {
        "@type": "WebSite",
        "@id": `${url}#site`,
        name: brand.name,
        url,
        inLanguage: "fr-FR",
        publisher: { "@id": organization },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#logiciel`,
        name: brand.name,
        url,
        description: seo.summary,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        inLanguage: "fr-FR",
        publisher: { "@id": organization },
        offers: {
          "@type": "Offer",
          price: String(pricing.amount),
          priceCurrency: pricing.currency,
          description: "Tarif fondateur, par mois",
          availability: "https://schema.org/PreOrder",
          url: `${url}#inscription`,
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: "fr-FR",
        mainEntity: faq.items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
}

/** Sérialisation sûre dans une balise <script> (aucun « < » brut). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
