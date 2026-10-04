"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { t } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Attendance = "confirmed" | "attended" | "no_show";

/**
 * Pointage Présent / Absent en un geste : retour immédiat (optimiste), la fonction SQL
 * set_attendance tranche ; en cas d'erreur l'état revient et un toast l'explique.
 */
export function AttendanceToggle({
  bookingId,
  sessionId,
  status,
  memberName,
  mark,
}: {
  bookingId: string;
  sessionId: string;
  status: Attendance;
  memberName: string;
  mark: (input: {
    bookingId: string;
    sessionId: string;
    status: "attended" | "no_show";
  }) => Promise<{ error: MessageKey | null }>;
}) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();

  function choose(value: string) {
    if (value !== "attended" && value !== "no_show") return;
    if (value === optimistic) return;
    startTransition(async () => {
      setOptimistic(value);
      const result = await mark({ bookingId, sessionId, status: value });
      if (result.error) toast.error(t(result.error), { closeButton: true });
    });
  }

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={optimistic === "confirmed" ? "" : optimistic}
      onValueChange={choose}
      aria-label={t("session.attendanceFor", { name: memberName })}
      aria-busy={pending}
      className="shrink-0"
    >
      <ToggleGroupItem
        value="attended"
        className={cn(
          "h-9 px-3 pointer-coarse:h-10 data-[state=on]:bg-success/10 data-[state=on]:text-success",
        )}
      >
        {t("session.markAttended")}
      </ToggleGroupItem>
      <ToggleGroupItem
        value="no_show"
        className="h-9 px-3 pointer-coarse:h-10 data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive"
      >
        {t("session.markNoShow")}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
