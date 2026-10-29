import { Benefits } from "@/components/sections/benefits";
import { Demo } from "@/components/sections/demo";
import { Faq } from "@/components/sections/faq";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Problem } from "@/components/sections/problem";
import { Proof } from "@/components/sections/proof";
import { Tagline } from "@/components/sections/tagline";

// Ordre du skill (A2) : hero, problème, bénéfices, phrase révélée, étapes, preuves, FAQ, démo.
export default function Home() {
  return (
    <main id="contenu">
      <Hero />
      <Problem />
      <Benefits />
      <Tagline />
      <HowItWorks />
      <Proof />
      <Faq />
      <Demo />
    </main>
  );
}
