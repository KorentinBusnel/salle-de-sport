import { HeaderSkeleton, PageSkeleton, TableSkeleton } from "@/components/skeletons";

/** Catalogue : tableau. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <TableSkeleton rows={6} columns={4} />
    </PageSkeleton>
  );
}
