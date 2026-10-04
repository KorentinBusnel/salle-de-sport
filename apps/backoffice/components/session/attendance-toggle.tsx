"use client";

import { RotateCcwIcon } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { t } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Attendance = "confirmed" | "attended" | "no_show";

/**
 * Pointage Présent / Absent en un geste : retour immédiat (optimiste), la fonction SQL
 * set_attendance tranche ; en cas d'erreur l'état revient et un toast l'explique.
 * Si la salle l'autorise (`reset`), un pointage se défait : clic sur l'option active ou ↺.
 */
export function AttendanceToggle({
  bookingId,
  sessionId,
  status,
  memberName,
  mark,
  reset,
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
  reset?:
    | ((input: { bookingId: string; sessionId: string }) => Promise<{ error: MessageKey | null }>)
    | undefined;
}) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();

  function undo() {
    if (!reset || optimistic === "confirmed") return;
    startTransition(async () => {
      setOptimistic("confirmed");
      const result = await reset({ bookingId, sessionId });
      if (result.error) toast.error(t(result.error), { closeButton: true });
    });
  }

  function choose(value: string) {
    if (value === "") return undo();
    if (value !== "attended" && value !== "no_show") return;
    if (value === optimistic) return;
    startTransition(async () => {
      setOptimistic(value);
      const result = await mark({ bookingId, sessionId, status: value });
      if (result.error) toast.error(t(result.error), { closeButton: true });
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
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
      {reset && optimistic !== "confirmed" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={undo}
          disabled={pending}
          aria-label={t("session.resetAttendanceOf", { name: memberName })}
          title={t("session.resetAttendance")}
          className="text-muted-foreground"
        >
          <RotateCcwIcon />
        </Button>
      ) : null}
    </div>
  );
}
