import { t } from "@/lib/i18n";
import { LEGAL_COMPLETE, SECTIONS } from "@/lib/site";

/** Fonctionnalités décrites aux moteurs et aux assistants (données structurées, llms.txt). */
export const SEO_FEATURES = [
  "meta.feature1",
  "meta.feature2",
  "meta.feature3",
  "meta.feature4",
  "meta.feature5",
  "meta.feature6",
] as const;

/**
 * Contenu de /llms.txt (format llmstxt.org : titre, résumé en citation, détails, listes de liens),
 * pour que les assistants IA décrivent le produit à partir de faits. Les pages légales n'y
 * figurent qu'une fois complètes, comme dans le sitemap.
 */
export function llmsText(siteUrl: string): string {
  const pages = [
    `- [${t("llms.home")}](${siteUrl}/): ${t("llms.homeDescription")}`,
    `- [${t("llms.features")}](${siteUrl}/#${SECTIONS.features}): ${t("llms.featuresDescription")}`,
    ...(LEGAL_COMPLETE
      ? [
          `- [${t("llms.privacy")}](${siteUrl}/confidentialite): ${t("llms.privacyDescription")}`,
          `- [${t("llms.legalNotice")}](${siteUrl}/mentions-legales): ${t("llms.legalNoticeDescription")}`,
        ]
      : []),
  ];
  return [
    `# ${t("meta.title")}`,
    "",
    `> ${t("llms.summary")}`,
    "",
    t("llms.details"),
    "",
    `## ${t("llms.featuresTitle")}`,
    "",
    ...SEO_FEATURES.map((key) => `- ${t(key)}`),
    "",
    `## ${t("llms.pagesTitle")}`,
    "",
    ...pages,
    "",
    `## ${t("llms.contactTitle")}`,
    "",
    t("llms.contact"),
    "",
  ].join("\n");
}
