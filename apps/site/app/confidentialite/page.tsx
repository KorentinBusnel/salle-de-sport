import type { Metadata } from "next";
import { LegalPage, LegalSection, LegalValue } from "@/components/legal-page";
import { t } from "@/lib/i18n";
import { LEGAL, LEGAL_COMPLETE } from "@/lib/site";

export const metadata: Metadata = {
  title: t("legal.privacy.title"),
  description: t("legal.privacy.description"),
  alternates: { canonical: "/confidentialite" },
  // Pas d'indexation tant que des mentions restent « à compléter » (lib/site.ts).
  ...(LEGAL_COMPLETE ? {} : { robots: { index: false, follow: true } }),
};

const SECTIONS = [
  ["legal.privacy.collectedTitle", "legal.privacy.collected"],
  ["legal.privacy.purposeTitle", "legal.privacy.purpose"],
  ["legal.privacy.recipientsTitle", "legal.privacy.recipients"],
  ["legal.privacy.retentionTitle", "legal.privacy.retention"],
  ["legal.privacy.cookiesTitle", "legal.privacy.cookies"],
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage title={t("legal.privacy.title")}>
      <LegalSection title={t("legal.privacy.controllerTitle")}>
        <p>
          <LegalValue value={LEGAL.company || null} />
          {LEGAL.address ? `, ${LEGAL.address}` : null}
        </p>
      </LegalSection>
      {SECTIONS.map(([title, body]) => (
        <LegalSection key={title} title={t(title)}>
          <p>{t(body)}</p>
        </LegalSection>
      ))}
      <LegalSection title={t("legal.privacy.rightsTitle")}>
        <p>{t("legal.privacy.rights", { email: LEGAL.contactEmail || t("legal.toComplete") })}</p>
      </LegalSection>
    </LegalPage>
  );
}
