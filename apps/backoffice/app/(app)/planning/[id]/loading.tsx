import { CardsSkeleton, HeaderSkeleton, PageSkeleton, TableSkeleton } from "@/components/skeletons";

/** Fiche séance : remplissage, puis inscrits. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton actions={2} />
      <CardsSkeleton count={3} className="xl:grid-cols-3" />
      <TableSkeleton rows={8} columns={3} />
    </PageSkeleton>
  );
}
