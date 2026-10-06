import "server-only";
import {
  canSeeFinancials,
  deskWindows,
  hasOpeningHours,
  isLowFill,
  isStaffRole,
  openingIntervals,
  sessionPhase,
  shiftDateKey,
  uncoveredIntervals,
  zonedDateKey,
  zonedDayRange,
  zonedStartOfDateKey,
} from "@salle/shared";
import { cache } from "react";
import type { TeamContext } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { getCrmTodo } from "@/lib/nav-counts";
import { getGymConfig } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

/*
 * Lectures de l'accueil, mémorisées pour la requête : chaque section (sous Suspense) appelle
 * ce dont elle a besoin, une même lecture n'est faite qu'une fois.
 */

export const getTodayFrame = cache((context: TeamContext) => {
  const now = currentTime();
  const tz = context.gym.timezone;
  const { start, end } = zonedDayRange(now, tz);
  const isCoachOnly = context.role === "coach";
  return {
    now,
    tz,
    start,
    end,
    today: zonedDateKey(now, tz),
    isCoachOnly,
    manager: canSeeFinancials(context.role),
    frontDesk: isStaffRole(context.role) && !isCoachOnly,
  };
});

export const getTodaySessions = cache(async (context: TeamContext) => {
  const frame = getTodayFrame(context);
  const supabase = await createClient();
  const [{ data, error }, config] = await Promise.all([
    supabase
      .from("class_sessions")
      .select(
        "id, starts_at, ends_at, capacity, status, booked_count, waitlist_count, disciplines(name, color), session_coaches(position, coaches(display_name, profile_id)), bookings(status)",
      )
      .eq("gym_id", context.gym.id)
      .gte("starts_at", frame.start.toISOString())
      .lt("starts_at", frame.end.toISOString())
      .order("starts_at"),
    getGymConfig(context.gym.id),
  ]);
  if (error) throw new Error("today_sessions");
  const sessions = data.map((session) => {
    const phase = sessionPhase(new Date(session.starts_at), new Date(session.ends_at), frame.now);
    // Réservations lisibles : toutes pour l'accueil, celles de ses cours pour un coach (RLS).
    const toCheck =
      session.status === "scheduled" && phase !== "upcoming"
        ? session.bookings.filter((b) => b.status === "confirmed").length
        : 0;
    const mine = session.session_coaches.some((sc) => sc.coaches?.profile_id === context.userId);
    const lowFill = isLowFill({
      booked: session.booked_count,
      capacity: session.capacity,
      percent: config.private.low_fill_percent,
      phase,
      status: session.status,
    });
    return { ...session, phase, toCheck, mine, lowFill };
  });
  const scheduled = sessions.filter((s) => s.status === "scheduled");
  const counted = frame.isCoachOnly ? scheduled.filter((s) => s.mine) : scheduled;
  return {
    sessions,
    scheduled,
    counted,
    booked: counted.reduce((sum, s) => sum + s.booked_count, 0),
    capacity: counted.reduce((sum, s) => sum + s.capacity, 0),
    waitlist: counted.reduce((sum, s) => sum + s.waitlist_count, 0),
    toCheck: counted.reduce((sum, s) => sum + s.toCheck, 0),
  };
});

export const getTodayTrials = cache(async (context: TeamContext) => {
  const frame = getTodayFrame(context);
  const supabase = await createClient();
  const { data } = await supabase.rpc("today_trials", {
    p_gym_id: context.gym.id,
    p_day: frame.today,
  });
  const trials = data ?? [];
  const sessions = [...new Map(trials.map((row) => [row.session_id, row])).values()].map(
    (first) => ({ ...first, people: trials.filter((row) => row.session_id === first.session_id) }),
  );
  const newcomers = [...new Map(trials.map((row) => [row.member_id, row])).values()];
  return { trials, sessions, newcomers };
});

export const getTodayDesk = cache(async (context: TeamContext) => {
  const frame = getTodayFrame(context);
  const supabase = await createClient();
  const [{ data }, { scheduled }, config] = await Promise.all([
    supabase
      .from("desk_shifts")
      .select(
        "id, profile_id, starts_at, ends_at, note, profiles!desk_shifts_profile_id_fkey(first_name, last_name)",
      )
      .eq("gym_id", context.gym.id)
      .lt("starts_at", frame.end.toISOString())
      .gt("ends_at", frame.start.toISOString())
      .order("starts_at"),
    getTodaySessions(context),
    getGymConfig(context.gym.id),
  ]);
  const shifts = data ?? [];
  // Présence attendue : horaires d'ouverture du jour, sinon séances ± marge (réglages).
  const gaps = uncoveredIntervals(
    deskWindows(scheduled, {
      opening: openingIntervals(config.openingHours, frame.today, frame.tz),
      marginMinutes: config.private.desk_margin_minutes,
    }),
    shifts,
    config.private.desk_min_gap_minutes,
  );
  return {
    shifts,
    gaps,
    defaultSlot: {
      start: config.private.desk_default_start,
      end: config.private.desk_default_end,
    },
  };
});

export const getUnpaid = cache(async (context: TeamContext) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("unpaid_members", { p_gym_id: context.gym.id });
  const rows = data ?? [];
  return { rows, total: rows.reduce((sum, row) => sum + row.amount_cents, 0) };
});

/** Actions qui attendent l'utilisateur (titre de l'accueil). */
export async function getActionCount(context: TeamContext): Promise<number> {
  const frame = getTodayFrame(context);
  const [{ toCheck }, desk, todo, unpaid] = await Promise.all([
    getTodaySessions(context),
    getTodayDesk(context),
    frame.manager ? getCrmTodo(context.gym.id) : [],
    frame.manager ? getUnpaid(context) : null,
  ]);
  return (
    toCheck +
    desk.gaps.length +
    todo.reduce((sum, row) => sum + row.total, 0) +
    (unpaid?.rows.length ?? 0)
  );
}

/** Jours de fermeture des deux semaines à venir où des séances restent prévues (gérant). */
export const getClosureConflicts = cache(async (context: TeamContext) => {
  const frame = getTodayFrame(context);
  const supabase = await createClient();
  const last = shiftDateKey(frame.today, 13);
  const { data: closures } = await supabase
    .from("gym_closures")
    .select("id, day, label")
    .eq("gym_id", context.gym.id)
    .gte("day", frame.today)
    .lte("day", last)
    .order("day");
  if (!closures?.length) return [];
  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("starts_at")
    .eq("gym_id", context.gym.id)
    .eq("status", "scheduled")
    .gte("starts_at", zonedStartOfDateKey(frame.today, frame.tz).toISOString())
    .lt("starts_at", zonedStartOfDateKey(shiftDateKey(last, 1), frame.tz).toISOString());
  const perDay = new Map<string, number>();
  for (const session of sessions ?? []) {
    const key = zonedDateKey(new Date(session.starts_at), frame.tz);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  return closures
    .map((closure) => ({ ...closure, sessions: perDay.get(closure.day) ?? 0 }))
    .filter((closure) => closure.sessions > 0);
});

export type SetupStep = {
  key: "identity" | "logo" | "hours" | "disciplines" | "templates" | "team";
  done: boolean;
  href: string;
};

/** Mise en route de la salle (gérant) : étapes faites ou non ; masquée une fois tout fait. */
export const getSetupSteps = cache(async (context: TeamContext): Promise<SetupStep[]> => {
  const supabase = await createClient();
  const [config, disciplines, templates, team] = await Promise.all([
    getGymConfig(context.gym.id),
    supabase
      .from("disciplines")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", context.gym.id)
      .eq("is_active", true),
    supabase
      .from("class_templates")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", context.gym.id),
    supabase.rpc("team_members", { p_gym_id: context.gym.id }),
  ]);
  const identity = config.identity;
  const staff = (team.data ?? []).filter((m) => m.roles.some((role) => role !== "member"));
  return [
    {
      key: "identity",
      done: Boolean(identity.address && (identity.phone || identity.email)),
      href: "/parametres",
    },
    { key: "logo", done: Boolean(identity.logoPath), href: "/parametres" },
    { key: "hours", done: hasOpeningHours(config.openingHours), href: "/parametres" },
    {
      key: "disciplines",
      done: (disciplines.count ?? 0) > 0,
      href: "/parametres?onglet=catalogue",
    },
    { key: "templates", done: (templates.count ?? 0) > 0, href: "/planning/modeles" },
    { key: "team", done: staff.length > 1, href: "/parametres?onglet=equipe" },
  ];
});
