import { z } from "zod";

/** L'accueil est attendu 30 min avant la première séance et jusqu'à 30 min après la dernière. */
export const DESK_MARGIN_MINUTES = 30;
/** Un trou de permanence plus court n'est pas signalé. */
export const DESK_MIN_GAP_MINUTES = 15;

type Interval = { start: Date; end: Date };
type Timed = { starts_at: string | Date; ends_at: string | Date };

const at = (value: string | Date) => new Date(value).getTime();

/** Plage où l'accueil doit être tenu, d'après les séances de la journée (null sans séance). */
export function deskWindow(sessions: Timed[]): Interval | null {
  if (sessions.length === 0) return null;
  const margin = DESK_MARGIN_MINUTES * 60_000;
  return {
    start: new Date(Math.min(...sessions.map((s) => at(s.starts_at))) - margin),
    end: new Date(Math.max(...sessions.map((s) => at(s.ends_at))) + margin),
  };
}

/** Trous de la plage non couverts par une permanence (au moins DESK_MIN_GAP_MINUTES). */
export function uncoveredIntervals(window: Interval | null, shifts: Timed[]): Interval[] {
  if (!window) return [];
  const minGap = DESK_MIN_GAP_MINUTES * 60_000;
  const sorted = shifts
    .map((s) => ({ start: at(s.starts_at), end: at(s.ends_at) }))
    .filter((s) => s.end > window.start.getTime() && s.start < window.end.getTime())
    .sort((a, b) => a.start - b.start);
  const gaps: Interval[] = [];
  let cursor = window.start.getTime();
  for (const shift of sorted) {
    if (shift.start - cursor >= minGap)
      gaps.push({ start: new Date(cursor), end: new Date(shift.start) });
    cursor = Math.max(cursor, shift.end);
  }
  if (window.end.getTime() - cursor >= minGap)
    gaps.push({ start: new Date(cursor), end: window.end });
  return gaps;
}

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure HH:MM");
export const clockToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

/** Créneau de permanence saisi au back office (date et heures dans le fuseau de la salle). */
export const deskShiftInputSchema = z
  .object({
    id: z.guid().optional(),
    profileId: z.guid(),
    date: z.iso.date(),
    start: clock,
    end: clock,
    note: z.string().trim().max(200).optional(),
  })
  .refine((value) => clockToMinutes(value.end) > clockToMinutes(value.start), {
    path: ["end"],
    message: "end_before_start",
  });
export type DeskShiftInput = z.infer<typeof deskShiftInputSchema>;
