import { CardsSkeleton, HeaderSkeleton, PageSkeleton } from "@/components/skeletons";

/** Indicateurs : période, compteurs, graphiques. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton actions={1} />
      <CardsSkeleton />
      <CardsSkeleton count={2} className="lg:grid-cols-2 xl:grid-cols-2" height="h-72" />
    </PageSkeleton>
  );
}
