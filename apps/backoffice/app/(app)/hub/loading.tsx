import { HeaderSkeleton, PageSkeleton, SplitSkeleton } from "@/components/skeletons";

/** Hub : conversations et fil. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <SplitSkeleton aside="18rem" />
    </PageSkeleton>
  );
}
