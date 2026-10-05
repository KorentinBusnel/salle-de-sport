import {
  FiltersSkeleton,
  HeaderSkeleton,
  PageSkeleton,
  TableSkeleton,
} from "@/components/skeletons";

/** Messages : filtres puis liste. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <FiltersSkeleton count={4} />
      <TableSkeleton rows={10} columns={3} />
    </PageSkeleton>
  );
}
