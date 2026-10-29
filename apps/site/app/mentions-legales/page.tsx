import type { Metadata } from "next";
import { LegalPage, LegalSection, LegalValue } from "@/components/legal-page";
import { t, type MessageKey } from "@/lib/i18n";
import { LEGAL } from "@/lib/site";

export const metadata: Metadata = {
  title: t("legal.notice.title"),
  description: t("legal.notice.description"),
  alternates: { canonical: "/mentions-legales" },
};

const PUBLISHER: { label: MessageKey; value: string | null }[] = [
  { label: "legal.notice.company", value: LEGAL.company },
  { label: "legal.notice.address", value: LEGAL.address },
  { label: "legal.notice.siren", value: LEGAL.siren },
  { label: "legal.notice.director", value: LEGAL.director },
  { label: "legal.notice.contact", value: LEGAL.contactEmail },
];

export default function LegalNoticePage() {
  return (
    <LegalPage title={t("legal.notice.title")}>
      <LegalSection title={t("legal.notice.publisherTitle")}>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
          {PUBLISHER.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="font-medium text-foreground">{t(label)}</dt>
              <dd className="sm:col-span-2">
                <LegalValue value={value} />
              </dd>
            </div>
          ))}
        </dl>
      </LegalSection>
      <LegalSection title={t("legal.notice.hostTitle")}>
        <p>{t("legal.notice.host")}</p>
      </LegalSection>
    </LegalPage>
  );
}
