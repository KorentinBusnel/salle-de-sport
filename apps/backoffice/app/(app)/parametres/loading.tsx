import { HeaderSkeleton, PageSkeleton, SplitSkeleton } from "@/components/skeletons";

/** Paramètres : sections à gauche, réglages à droite. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <SplitSkeleton aside="15rem" items={5} />
    </PageSkeleton>
  );
}
