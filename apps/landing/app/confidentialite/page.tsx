import type { Metadata } from "next";
import { privacyPolicy } from "@/content/legal";
import { LegalPageView } from "@/components/legal-page";

export const metadata: Metadata = {
  title: privacyPolicy.title,
  description: privacyPolicy.description,
  alternates: { canonical: "/confidentialite" },
};

export default function PrivacyPage() {
  return <LegalPageView page={privacyPolicy} />;
}
