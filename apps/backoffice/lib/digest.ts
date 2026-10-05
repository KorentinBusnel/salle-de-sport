import "server-only";
import { type DailyDigest, dailyDigestSchema, zonedDateKey } from "@salle/shared";
import type { TeamContext } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { createClient } from "@/lib/supabase/server";

export type TodayDigest = DailyDigest & { day: string; generatedAt: string };

/** Digest du jour de la salle (gérant), ou null s'il n'a pas encore été généré. */
export async function getTodayDigest(context: TeamContext): Promise<TodayDigest | null> {
  const day = zonedDateKey(currentTime(), context.gym.timezone);
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_digests")
    .select("content, generated_at")
    .eq("gym_id", context.gym.id)
    .eq("day", day)
    .maybeSingle();
  if (!data) return null;
  const parsed = dailyDigestSchema.safeParse(data.content);
  return parsed.success ? { ...parsed.data, day, generatedAt: data.generated_at } : null;
}
