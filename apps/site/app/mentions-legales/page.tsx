import type { Metadata } from "next";
import { LegalList, LegalPage, LegalSection } from "@/components/legal-page";
import { t } from "@/lib/i18n";
import { LEGAL, LEGAL_COMPLETE } from "@/lib/site";

export const metadata: Metadata = {
  title: t("legal.notice.title"),
  description: t("legal.notice.description"),
  alternates: { canonical: "/mentions-legales" },
  // Pas d'indexation tant que des mentions restent « à compléter » (lib/site.ts).
  ...(LEGAL_COMPLETE ? {} : { robots: { index: false, follow: true } }),
};

/** Mentions légales (LCEN, art. 6) : éditeur et hébergeur, valeurs dans lib/site.ts. */
export default function LegalNoticePage() {
  return (
    <LegalPage title={t("legal.notice.title")}>
      <LegalSection title={t("legal.notice.publisherTitle")}>
        <LegalList
          rows={[
            { label: t("legal.notice.company"), value: LEGAL.company },
            { label: t("legal.notice.legalForm"), value: LEGAL.legalForm },
            { label: t("legal.notice.capital"), value: LEGAL.capital },
            { label: t("legal.notice.address"), value: LEGAL.address },
            { label: t("legal.notice.siren"), value: LEGAL.siren },
            { label: t("legal.notice.rcs"), value: LEGAL.rcs },
            { label: t("legal.notice.vat"), value: LEGAL.vat },
            { label: t("legal.notice.director"), value: LEGAL.director },
            { label: t("legal.notice.contact"), value: LEGAL.contactEmail },
            { label: t("legal.notice.phone"), value: LEGAL.phone },
          ]}
        />
      </LegalSection>
      <LegalSection title={t("legal.notice.hostTitle")}>
        <LegalList
          rows={[
            { label: t("legal.notice.company"), value: t("legal.notice.hostName") },
            { label: t("legal.notice.address"), value: t("legal.notice.hostAddress") },
            { label: t("legal.notice.phone"), value: LEGAL.hostPhone },
            { label: t("legal.notice.website"), value: t("legal.notice.hostWebsite") },
          ]}
        />
      </LegalSection>
    </LegalPage>
  );
}
