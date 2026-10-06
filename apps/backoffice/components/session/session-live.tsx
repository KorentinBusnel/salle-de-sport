"use client";

import { CheckCheckIcon } from "lucide-react";
import { createContext, type ReactNode, useContext, useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import {
  bookMemberQuick,
  markAllAttendedQuick,
  resetAttendanceMany,
} from "@/app/(app)/planning/[id]/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { UNDO_DURATION_MS } from "@/lib/toast-undo";

type PendingBooking = { id: string; name: string };
type SessionLive = {
  pending: PendingBooking[];
  allAttended: boolean;
  book: (member: PendingBooking) => void;
  markAll: () => void;
  busy: boolean;
};

const Live = createContext<SessionLive | null>(null);

/**
 * Fiche séance réactive : une inscription apparaît aussitôt dans la liste (« ajout en cours »),
 * « Tous présents » coche toutes les lignes avant la réponse ; le serveur tranche ensuite et la
 * page se met à jour (refresh). En cas de refus, l'état revient et un toast explique.
 */
export function SessionLiveProvider({
  sessionId,
  allowReset,
  children,
}: {
  sessionId: string;
  /** Stratégie « pointage modifiable » : « Tous présents » se rattrape par « Annuler ». */
  allowReset: boolean;
  children: ReactNode;
}) {
  const [pending, addPending] = useOptimistic<PendingBooking[], PendingBooking>(
    [],
    (state, item) => [...state, item],
  );
  const [allAttended, setAllAttended] = useOptimistic(false);
  const [busy, startTransition] = useTransition();

  function book(member: PendingBooking) {
    startTransition(async () => {
      addPending(member);
      const result = await bookMemberQuick({ sessionId, memberId: member.id });
      if (!result.ok) toast.error(t(result.error), { closeButton: true });
      else if (result.message) toast.success(`${member.name} : ${t(result.message)}`);
    });
  }

  function markAll() {
    startTransition(async () => {
      setAllAttended(true);
      const result = await markAllAttendedQuick({ sessionId });
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      const ids = result.data;
      toast.success(t("session.allAttendedCount", { count: ids.length }), {
        duration: UNDO_DURATION_MS,
        ...(allowReset && ids.length
          ? {
              action: {
                label: t("ui.undo"),
                onClick: () => {
                  void resetAttendanceMany({ sessionId, bookingIds: ids }).then((undone) => {
                    if (undone.ok) toast(t("ui.undone"));
                    else toast.error(t(undone.error), { closeButton: true });
                  });
                },
              },
            }
          : {}),
      });
    });
  }

  return (
    <Live.Provider value={{ pending, allAttended, book, markAll, busy }}>{children}</Live.Provider>
  );
}

export function useSessionLive() {
  return useContext(Live);
}

/** Fin de la liste des inscrits : inscriptions en cours, ou message si la liste est vide. */
export function AttendeeListTail({ empty, hasRows }: { empty: string; hasRows: boolean }) {
  const live = useSessionLive();
  const pending = live?.pending ?? [];
  if (!hasRows && pending.length === 0) {
    return <li className="px-2 py-4 text-sm text-muted-foreground">{empty}</li>;
  }
  return pending.map((member) => (
    <li
      key={member.id}
      aria-busy="true"
      className="flex items-center gap-3 rounded-lg px-2 py-2 text-muted-foreground"
    >
      <Avatar className="size-9">
        <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate font-medium">{member.name}</span>
      <span className="flex items-center gap-2 text-xs">
        <Spinner />
        {t("session.booking")}
      </span>
    </li>
  ));
}

/** « Tous présents » : pointe d'un geste les inscrits encore confirmés. */
export function MarkAllButton() {
  const live = useSessionLive();
  if (!live) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={live.busy || live.allAttended}
      onClick={live.markAll}
    >
      {live.allAttended ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <CheckCheckIcon data-icon="inline-start" aria-hidden />
      )}
      {t("session.markAllAttended")}
    </Button>
  );
}
