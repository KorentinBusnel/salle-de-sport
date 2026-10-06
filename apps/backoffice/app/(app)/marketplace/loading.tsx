import { CardsSkeleton, HeaderSkeleton, PageSkeleton, TabsSkeleton } from "@/components/skeletons";

/** Marketplace : en-tête, onglets puis cartes produits. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton actions={2} />
      <TabsSkeleton count={3} />
      <CardsSkeleton count={6} className="xl:grid-cols-3" height="h-56" />
    </PageSkeleton>
  );
}
