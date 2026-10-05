import { CardsSkeleton, HeaderSkeleton, PageSkeleton } from "@/components/skeletons";

/** Pipeline : colonnes d'étapes. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton actions={1} />
      <CardsSkeleton count={5} className="xl:grid-cols-5" height="h-96" />
    </PageSkeleton>
  );
}
