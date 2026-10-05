import { HeaderSkeleton, PageSkeleton, SplitSkeleton } from "@/components/skeletons";

/** Fiche coach : disponibilités et séances. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <SplitSkeleton aside="18rem" items={4} />
    </PageSkeleton>
  );
}
