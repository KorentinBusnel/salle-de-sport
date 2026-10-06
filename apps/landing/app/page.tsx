import { Faq } from "@/components/faq";
import { FinalCta } from "@/components/final-cta";
import { Hero } from "@/components/hero";
import { JsonLd } from "@/components/json-ld";
import { PreviewSection } from "@/components/preview/preview-section";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WaitlistProvider } from "@/components/waitlist-provider";

// Page statique : tout le texte est dans le HTML (référencement, assistants IA).
export const dynamic = "force-static";

export default function LandingPage() {
  return (
    <>
      <JsonLd />
      <SiteHeader />
      <WaitlistProvider>
        <main>
          <Hero />
          <PreviewSection />
          <FinalCta />
          <Faq />
        </main>
      </WaitlistProvider>
      <SiteFooter />
    </>
  );
}
