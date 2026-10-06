import { HeaderSkeleton, PageSkeleton, TableSkeleton, TabsSkeleton } from "@/components/skeletons";

/** Emailing (campagnes, modèles, automatisations) : onglets puis tableau. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <TabsSkeleton count={3} />
      <TableSkeleton rows={6} columns={4} />
    </PageSkeleton>
  );
}
