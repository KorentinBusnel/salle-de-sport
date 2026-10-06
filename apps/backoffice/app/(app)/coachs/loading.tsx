import { HeaderSkeleton, PageSkeleton, TableSkeleton } from "@/components/skeletons";

/** Coachs : tableau. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton actions={1} />
      <TableSkeleton rows={6} columns={5} />
    </PageSkeleton>
  );
}
