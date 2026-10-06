import { HeaderSkeleton, PageSkeleton, SplitSkeleton, TabsSkeleton } from "@/components/skeletons";

/** Fiche adhérent : en-tête, onglets, contenu et colonne d'informations. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton actions={2} />
      <TabsSkeleton count={5} />
      <SplitSkeleton aside="18rem" items={4} />
    </PageSkeleton>
  );
}
