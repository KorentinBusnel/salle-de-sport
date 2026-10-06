import { DailyBrief } from "@/components/today/daily-brief";
import type { TeamContext } from "@/lib/auth";
import { getTodayDigest } from "@/lib/digest";

/** Brief du jour (gérant, assistant configuré), chargé à part. */
export async function BriefSection({ context }: { context: TeamContext }) {
  return <DailyBrief digest={await getTodayDigest(context)} />;
}
