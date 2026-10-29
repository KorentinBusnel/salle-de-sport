import { Adaptable } from "@/components/sections/adaptable";
import { Benefits } from "@/components/sections/benefits";
import { Faq } from "@/components/sections/faq";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Problem } from "@/components/sections/problem";
import { Start } from "@/components/sections/start";
import { Tagline } from "@/components/sections/tagline";

// Page statique relue toutes les heures : le compteur de salles du hero se met à jour.
export const revalidate = 3600;

// Hero, problème, toutes les salles, fonctionnalités (dérouleur), phrase révélée, étapes, FAQ,
// démarrage (formulaire).
export default function Home() {
  return (
    <main id="contenu">
      <Hero />
      <Problem />
      <Adaptable />
      <Benefits />
      <Tagline />
      <HowItWorks />
      <Faq />
      <Start />
    </main>
  );
}
