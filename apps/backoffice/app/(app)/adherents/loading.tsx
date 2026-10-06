import {
  FiltersSkeleton,
  HeaderSkeleton,
  PageSkeleton,
  TableSkeleton,
  TabsSkeleton,
} from "@/components/skeletons";

/** Adhérents : onglets de statut, filtres, tableau. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton actions={1} />
      <TabsSkeleton count={5} />
      <FiltersSkeleton />
      <TableSkeleton rows={10} columns={5} />
    </PageSkeleton>
  );
}
