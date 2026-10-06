import { brand, faq, hero, launch, preview, pricing, seo } from "@/content/landing";

/**
 * /llms.txt (convention proposée sur llmstxt.org) : résumé Markdown du produit pour les
 * assistants IA, généré depuis le même contenu que la page. Pas de section « Intégrations »
 * (BRIEF §12, 2026-10-06).
 */
export function buildLlmsTxt(base: URL): string {
  const home = new URL("/", base).href;
  const modules = preview.steps
    .filter((step) => step.items)
    .map((step) => `- ${step.label} : ${step.items}`);
  return [
    `# ${brand.name}`,
    "",
    `> ${seo.summary}`,
    "",
    `${hero.title.before}${hero.title.emphasis}${hero.title.after} ${hero.subtitle}`,
    "",
    "## Produit",
    "",
    `${brand.name} est un logiciel de gestion de salle de sport (back office web et application mobile pour les adhérents) assisté par l'intelligence artificielle. Modules :`,
    "",
    ...modules,
    "",
    "## Pour qui",
    "",
    faq.items[1]?.answer ?? "",
    "",
    "## Tarif",
    "",
    `${pricing.label} : ${pricing.display} par mois ${pricing.audience}.`,
    "",
    "## Lancement",
    "",
    `Lancement prévu ${launch.label}. Liste d'attente ouverte : ${home}#inscription`,
    "",
    "## Questions fréquentes",
    "",
    ...faq.items.flatMap((item) => [`### ${item.question}`, "", item.answer, ""]),
    "## Liens",
    "",
    `- [Page d'accueil](${home})`,
    `- [Questions fréquentes](${home}#faq)`,
    `- [Contact](mailto:${brand.contactEmail})`,
    "",
  ].join("\n");
}
