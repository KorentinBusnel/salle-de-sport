import type { Metadata } from "next";
import { legalNotice } from "@/content/legal";
import { LegalPageView } from "@/components/legal-page";

export const metadata: Metadata = {
  title: legalNotice.title,
  description: legalNotice.description,
  alternates: { canonical: "/mentions-legales" },
};

export default function LegalNoticePage() {
  return <LegalPageView page={legalNotice} />;
}
