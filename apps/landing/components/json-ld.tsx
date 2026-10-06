import { buildJsonLd, serializeJsonLd } from "@/lib/jsonld";
import { siteUrl } from "@/lib/site";

/** Données structurées de la page (lib/jsonld.ts). */
export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      // Contenu statique du dépôt, sérialisé sans « < » brut.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildJsonLd(siteUrl())) }}
    />
  );
}
