import { HeaderSkeleton, PageSkeleton, TableSkeleton } from "@/components/skeletons";

/** Cours récurrents : tableau. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <TableSkeleton rows={8} columns={6} />
    </PageSkeleton>
  );
}
