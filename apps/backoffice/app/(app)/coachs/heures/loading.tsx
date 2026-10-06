import { HeaderSkeleton, PageSkeleton, TableSkeleton } from "@/components/skeletons";

/** Heures des coachs : tableau mensuel. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton actions={1} />
      <TableSkeleton rows={6} columns={4} />
    </PageSkeleton>
  );
}
