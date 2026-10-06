import { HeaderSkeleton, PageSkeleton, SplitSkeleton } from "@/components/skeletons";

/** Segments : liste et filtres. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton actions={1} />
      <SplitSkeleton />
    </PageSkeleton>
  );
}
