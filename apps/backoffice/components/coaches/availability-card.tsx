"use client";

import { saveAvailability } from "@/app/(app)/coachs/actions";
import { WeeklySlotsEditor, type WeeklySlots } from "@/components/forms/weekly-slots-editor";
import { useAutosave } from "@/components/settings/setting-rows";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";

/**
 * Disponibilités hebdomadaires d'un coach (Watermelon slot-picker) : chaque modification valide
 * est enregistrée aussitôt, avec « Annuler » pendant 10 secondes.
 */
export function AvailabilityCard({ coachId, week }: { coachId: string; week: WeeklySlots }) {
  const { value, commit } = useAutosave<WeeklySlots>(
    week,
    (next) => saveAvailability(coachId, next),
    `availability-${coachId}`,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("coaches.availability")}</CardTitle>
        <CardDescription>{t("coaches.availabilityHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <WeeklySlotsEditor
          value={value}
          defaultSlot={{ start: "07:00", end: "12:00" }}
          labels={{
            closed: t("coaches.unavailable"),
            dayOpen: (day) => t("coaches.dayAvailable", { day }),
          }}
          onCommit={(next) => commit(next, t("coaches.availabilitySaved"))}
        />
      </CardContent>
    </Card>
  );
}
