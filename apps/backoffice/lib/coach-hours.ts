import "server-only";
import { monthRange, zonedStartOfDateKey } from "@salle/shared";
import type { TeamContext } from "@/lib/auth";
import { isManagerRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { getOwnCoachId } from "@/lib/coaches";
import { createClient } from "@/lib/supabase/server";

/**
 * Heures réalisées d'un mois : synthèse par coach (fonction SQL coach_hours, qui ne renvoie
 * au coach que sa ligne) et, si demandé, le détail des séances tenues d'un coach.
 */
export async function loadCoachHours(context: TeamContext, month: string, coachId?: string) {
  const range = monthRange(month);
  if (!range) return null;
  const supabase = await createClient();
  const manager = isManagerRole(context.role);
  const ownId = manager ? null : await getOwnCoachId(context.userId, context.gym.id);

  const { data: rows, error } = await supabase.rpc("coach_hours", {
    p_gym_id: context.gym.id,
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw new Error(error.message);
  const summary = (rows ?? []).filter((r) => manager || r.coach_id === ownId);

  const target = coachId ?? (manager ? undefined : (ownId ?? undefined));
  const line = target ? summary.find((r) => r.coach_id === target) : undefined;
  let sessions: {
    id: string;
    starts_at: string;
    ends_at: string;
    minutes: number;
    discipline: string;
  }[] = [];
  if (line) {
    const tz = context.gym.timezone;
    const now = currentTime().toISOString();
    const { data } = await supabase
      .from("class_sessions")
      .select("id, starts_at, ends_at, disciplines(name), session_coaches!inner(coach_id)")
      .eq("gym_id", context.gym.id)
      .eq("session_coaches.coach_id", line.coach_id)
      .eq("status", "scheduled")
      .lte("ends_at", now)
      .gte("starts_at", zonedStartOfDateKey(range.from, tz).toISOString())
      .lt("starts_at", zonedStartOfDateKey(`${range.next}-01`, tz).toISOString())
      .order("starts_at");
    sessions = (data ?? []).map((s) => ({
      id: s.id,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      minutes: Math.round((Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60_000),
      discipline: s.disciplines?.name ?? "",
    }));
  }
  return { range, summary, line, sessions };
}

/** Champ CSV (séparateur « ; », usage français d'Excel) : guillemets si nécessaire. */
export function csvField(value: string | number): string {
  const text = String(value);
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
