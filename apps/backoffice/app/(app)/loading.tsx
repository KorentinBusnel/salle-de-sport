import { CardsSkeleton, HeaderSkeleton, PageSkeleton } from "@/components/skeletons";

/** Accueil : brief, quatre compteurs, trois colonnes d'actions. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <CardsSkeleton />
      <CardsSkeleton count={3} className="xl:grid-cols-3" height="h-72" />
    </PageSkeleton>
  );
}
