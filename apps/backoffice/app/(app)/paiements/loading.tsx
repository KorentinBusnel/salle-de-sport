import {
  FiltersSkeleton,
  HeaderSkeleton,
  PageSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

/** Paiements : totaux, filtres puis tableau. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <FiltersSkeleton count={3} />
      <TableSkeleton rows={10} columns={6} />
    </PageSkeleton>
  );
}
