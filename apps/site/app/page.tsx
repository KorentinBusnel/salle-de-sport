import { Benefits } from "@/components/sections/benefits";
import { Hero } from "@/components/sections/hero";

// Page statique relue toutes les heures : le compteur de salles du hero se met à jour.
export const revalidate = 3600;

// Hero (dont « Demander une démo »), fonctionnalités.
export default function Home() {
  return (
    <main id="contenu">
      <Hero />
      <Benefits />
    </main>
  );
}
