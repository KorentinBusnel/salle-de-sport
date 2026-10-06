import { HeaderSkeleton, PageSkeleton } from "@/components/skeletons";
import { HomeSectionSkeleton } from "@/components/today/home-section";

/** Accueil : titre, puis le bloc Opérations (indicateurs, deux cartes, séances du jour). */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton actions={1} />
      <HomeSectionSkeleton kpis={4} cards={2} list className="lg:grid-cols-2" />
    </PageSkeleton>
  );
}
