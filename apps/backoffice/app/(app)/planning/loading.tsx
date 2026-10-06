import { CardsSkeleton, HeaderSkeleton, PageSkeleton } from "@/components/skeletons";

/** Planning : barre de semaine puis grille. */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton actions={2} />
      <CardsSkeleton
        count={7}
        className="grid-cols-7 gap-2 sm:grid-cols-7 xl:grid-cols-7"
        height="h-[32rem]"
      />
    </PageSkeleton>
  );
}
