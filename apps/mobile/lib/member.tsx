import { type GymSettings, parseGymSettings } from "@salle/shared";
import type { Tables } from "@salle/supabase";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { SESSION_COACHES_SELECT, type SessionCoachRow } from "@/lib/coaches";
import { supabase } from "@/lib/supabase";

export type Gym = { id: string; name: string; timezone: string; settings: GymSettings };
type Member = Pick<
  Tables<"members">,
  "id" | "gym_id" | "first_name" | "last_name" | "email" | "status"
>;

export type MyBooking = Pick<
  Tables<"bookings">,
  "id" | "session_id" | "status" | "waitlist_position"
> & {
  class_sessions: {
    id: string;
    starts_at: string;
    ends_at: string;
    status: Tables<"class_sessions">["status"];
    disciplines: { name: string; color: string } | null;
    session_coaches: SessionCoachRow[];
  } | null;
};

type MemberState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "none" }
  | {
      status: "ready";
      member: Member;
      gym: Gym;
      hasSubscription: boolean;
      credits: number;
      bookings: MyBooking[];
    };

type MemberContextValue = { state: MemberState; refresh: () => Promise<void> };

const MemberContext = createContext<MemberContextValue>({
  state: { status: "loading" },
  refresh: async () => {},
});

async function loadMember(userId: string): Promise<MemberState> {
  const { data: member, error } = await supabase
    .from("members")
    .select("id, gym_id, first_name, last_name, email, status, gyms(id, name, timezone, settings)")
    .eq("profile_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) return { status: "error" };
  if (!member || !member.gyms) return { status: "none" };

  const [subscriptions, ledger, bookings] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id")
      .eq("member_id", member.id)
      .in("status", ["active", "trialing"])
      .limit(1),
    supabase.from("credit_ledger").select("delta").eq("member_id", member.id),
    supabase
      .from("bookings")
      .select(
        `id, session_id, status, waitlist_position, class_sessions(id, starts_at, ends_at, status, disciplines(name, color), ${SESSION_COACHES_SELECT})`,
      )
      .eq("member_id", member.id)
      .order("booked_at", { ascending: false })
      .limit(200),
  ]);
  if (subscriptions.error || ledger.error || bookings.error) return { status: "error" };

  const { gyms, ...rest } = member;
  return {
    status: "ready",
    member: rest,
    gym: {
      id: gyms.id,
      name: gyms.name,
      timezone: gyms.timezone,
      settings: parseGymSettings(gyms.settings),
    },
    hasSubscription: subscriptions.data.length > 0,
    credits: ledger.data.reduce((sum, row) => sum + row.delta, 0),
    bookings: bookings.data,
  };
}

/** Fiche adhérent de l'utilisateur connecté, avec ses crédits et ses réservations. */
export function MemberProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  // État rattaché à l'utilisateur chargé : après déconnexion ou changement de compte,
  // l'ancien état n'est plus valable et l'on repart de « chargement ».
  const [entry, setEntry] = useState<{ userId: string; state: MemberState } | null>(null);
  const state: MemberState = entry && entry.userId === userId ? entry.state : { status: "loading" };

  const refresh = useCallback(async () => {
    if (!userId) return;
    const next = await loadMember(userId);
    setEntry({ userId, state: next });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadMember(userId).then((next) => {
      if (active) setEntry({ userId, state: next });
    });
    return () => {
      active = false;
    };
  }, [userId]);

  return <MemberContext.Provider value={{ state, refresh }}>{children}</MemberContext.Provider>;
}

export function useMember(): MemberContextValue {
  return useContext(MemberContext);
}
