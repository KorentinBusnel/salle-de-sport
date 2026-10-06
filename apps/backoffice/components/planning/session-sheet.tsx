"use client";

import { BOOKING_STATUS_TONE, type BookingStatus } from "@salle/shared";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SegmentMeter } from "@/components/segment-meter";
import { DisciplineChip, StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";

export type SessionSummary = {
  id: string;
  discipline: string;
  color: string | undefined;
  /** « mardi 6 octobre · 12:15 – 13:15 », formaté dans le fuseau de la salle. */
  when: string;
  coaches: string;
  room: string | null;
  booked: number;
  capacity: number;
  waitlist: number;
  cancelled: boolean;
  lowFill: boolean;
};

type Person = { id: string; name: string; status: BookingStatus };

/**
 * Aperçu d'une séance sans quitter la grille : horaire, coachs, places et inscrits (chargés à
 * l'ouverture). La fiche complète reste à un clic.
 */
export function SessionSheet({
  session,
  onClose,
}: {
  session: SessionSummary | null;
  onClose: () => void;
}) {
  const [people, setPeople] = useState<{ id: string; list: Person[] | null } | null>(null);
  const id = session?.id ?? null;

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetch(`/api/seances/${id}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { people: [] }))
      .then((body: { people: Person[] }) => setPeople({ id, list: body.people }))
      .catch(() => {});
    return () => controller.abort();
  }, [id]);

  const list = people && people.id === id ? people.list : null;
  const seated = list?.filter((p) => p.status !== "waitlisted") ?? [];
  const waiting = list?.filter((p) => p.status === "waitlisted") ?? [];

  return (
    <Sheet open={session !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        {session ? (
          <>
            <SheetHeader className="gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <DisciplineChip name={session.discipline} color={session.color} />
                {session.cancelled ? (
                  <StatusPill tone="danger">{t("planning.cancelled")}</StatusPill>
                ) : session.lowFill ? (
                  <StatusPill tone="brand" dot={false}>
                    {t("today.lowFill")}
                  </StatusPill>
                ) : null}
              </div>
              <SheetTitle className="text-lg">{session.when}</SheetTitle>
              <SheetDescription>
                {[session.coaches, session.room].filter(Boolean).join(" · ")}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="grid content-start gap-5 pb-4">
              {!session.cancelled ? (
                <SegmentMeter
                  label={t("planning.occupancy")}
                  total={session.capacity}
                  segments={[
                    { label: t("planning.sheet.booked"), value: session.booked, tone: "brand" },
                    {
                      label: t("planning.sheet.free"),
                      value: Math.max(0, session.capacity - session.booked),
                      tone: "neutral",
                    },
                    ...(session.waitlist
                      ? [
                          {
                            label: t("planning.sheet.waitlist"),
                            value: session.waitlist,
                            tone: "warning" as const,
                          },
                        ]
                      : []),
                  ]}
                />
              ) : null}
              <section className="grid gap-2" aria-labelledby="apercu-inscrits">
                <h3 id="apercu-inscrits" className="text-sm font-medium">
                  {t("planning.sheet.people", { count: session.booked })}
                </h3>
                {list === null ? (
                  <div className="grid gap-2" aria-busy="true">
                    {Array.from({ length: Math.min(4, Math.max(1, session.booked)) }, (_, i) => (
                      <Skeleton key={i} className="h-8 rounded-lg" />
                    ))}
                  </div>
                ) : seated.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t(session.booked > 0 ? "planning.sheet.hidden" : "planning.sheet.nobody")}
                  </p>
                ) : (
                  <ul className="grid gap-1">
                    {seated.map((person) => (
                      <PersonRow key={person.id} person={person} />
                    ))}
                  </ul>
                )}
                {waiting.length ? (
                  <>
                    <h4 className="mt-2 text-xs font-medium text-muted-foreground">
                      {t("planning.sheet.waitlistTitle", { count: waiting.length })}
                    </h4>
                    <ul className="grid gap-1">
                      {waiting.map((person) => (
                        <PersonRow key={person.id} person={person} />
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>
            </SheetBody>
            <SheetFooter>
              <Button asChild>
                <Link href={`/planning/${session.id}`}>
                  {t("planning.sheet.open")}
                  <ArrowRightIcon data-icon="inline-end" aria-hidden />
                </Link>
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PersonRow({ person }: { person: Person }) {
  return (
    <li className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
      <Link href={`/adherents/${person.id}`} className="min-w-0 flex-1 truncate hover:underline">
        {person.name}
      </Link>
      <StatusPill tone={BOOKING_STATUS_TONE[person.status]}>
        {t(`bookingStatus.${person.status}`)}
      </StatusPill>
    </li>
  );
}
