import { PlusIcon } from "lucide-react";
import { DeskShiftDialog, type TeamOption } from "@/components/desk/desk-shift-dialog";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type DeskShiftView = {
  id: string;
  profileId: string;
  name: string;
  start: string;
  end: string;
  note: string | null;
};
export type DeskGapView = { start: string; end: string };

/**
 * Permanences d'une journée (planning) : créneaux et trous à couvrir. Le gérant modifie un
 * créneau en le touchant, ajoute avec « + » ; les autres rôles consultent.
 */
export function DeskDay({
  dayKey,
  shifts,
  gaps,
  team,
  manager,
  compact = false,
}: {
  dayKey: string;
  shifts: DeskShiftView[];
  gaps: DeskGapView[];
  team: TeamOption[];
  manager: boolean;
  compact?: boolean | undefined;
}) {
  const chip = cn(
    "flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs",
    compact ? "flex-col items-start gap-0" : "",
  );
  return (
    <ul className={cn("grid gap-1", !compact && "sm:flex sm:flex-wrap")}>
      {shifts.map((shift) => {
        const content = (
          <>
            <span className="font-medium tabular-nums">
              {shift.start}–{shift.end}
            </span>
            <span className="truncate text-muted-foreground">{shift.name}</span>
          </>
        );
        return (
          <li key={shift.id}>
            {manager ? (
              <DeskShiftDialog
                team={team}
                draft={{
                  id: shift.id,
                  profileId: shift.profileId,
                  date: dayKey,
                  start: shift.start,
                  end: shift.end,
                  note: shift.note ?? undefined,
                }}
                trigger={
                  <button
                    type="button"
                    className={cn(chip, "bg-muted hover:bg-accent")}
                    aria-label={t("desk.editShift", {
                      name: shift.name,
                      start: shift.start,
                      end: shift.end,
                    })}
                  >
                    {content}
                  </button>
                }
              />
            ) : (
              <span className={cn(chip, "bg-muted")}>{content}</span>
            )}
          </li>
        );
      })}
      {gaps.map((gap) => (
        <li key={gap.start}>
          {manager ? (
            <DeskShiftDialog
              team={team}
              draft={{ date: dayKey, start: gap.start, end: gap.end }}
              trigger={
                <button
                  type="button"
                  className={cn(
                    chip,
                    "bg-warning/10 text-warning ring-1 ring-warning/25 hover:bg-warning/15",
                  )}
                >
                  <span className="font-medium tabular-nums">
                    {gap.start}–{gap.end}
                  </span>
                  <span>{t("today.deskGap")}</span>
                </button>
              }
            />
          ) : (
            <span className={cn(chip, "bg-warning/10 text-warning")}>
              <span className="font-medium tabular-nums">
                {gap.start}–{gap.end}
              </span>
              <span>{t("today.deskGap")}</span>
            </span>
          )}
        </li>
      ))}
      {manager ? (
        <li>
          <DeskShiftDialog
            team={team}
            draft={{ date: dayKey, start: "09:00", end: "12:00" }}
            trigger={
              <button
                type="button"
                className="flex h-7 w-full items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t("desk.addTitle")}
              >
                <PlusIcon className="size-3.5" aria-hidden />
              </button>
            }
          />
        </li>
      ) : null}
      {!manager && shifts.length === 0 && gaps.length === 0 ? (
        <li className="px-2 py-1 text-xs text-muted-foreground">—</li>
      ) : null}
    </ul>
  );
}
