import { CalendarXIcon } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { TeamContext } from "@/lib/auth";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getClosureConflicts, getTodayFrame } from "@/lib/today";

/**
 * Jours de fermeture où des séances restent prévues (gérant) : une alerte, rien n'est bloqué —
 * la salle peut décider de maintenir ses cours.
 */
export async function ClosureAlert({ context }: { context: TeamContext }) {
  const conflicts = await getClosureConflicts(context);
  if (conflicts.length === 0) return null;
  const format = gymFormatters(getTodayFrame(context).tz);
  return (
    <Alert variant="soft-warning" role="status">
      <CalendarXIcon aria-hidden />
      <AlertTitle>{t("today.closures.title", { count: conflicts.length })}</AlertTitle>
      <AlertDescription className="grid gap-1">
        <ul className="grid gap-0.5">
          {conflicts.map((closure) => (
            <li key={closure.id}>
              <Link
                href={`/planning?jour=${closure.day}`}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {format.dayKey(closure.day)}
              </Link>
              {closure.label ? ` (${closure.label})` : ""}
              {" : "}
              <span className="tabular-nums">
                {t("today.closures.sessions", { count: closure.sessions })}
              </span>
            </li>
          ))}
        </ul>
        <p>{t("today.closures.hint")}</p>
      </AlertDescription>
    </Alert>
  );
}
