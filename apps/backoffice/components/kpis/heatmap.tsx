"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";

type Cell = { weekday: number; hour: number; seats: number; capacity: number };

const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;
const ratio = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/**
 * Remplissage par créneau (jour × heure de début) : intensité de la couleur principale, détail
 * au survol ou au focus (places occupées sur la capacité).
 */
export function Heatmap({ cells }: { cells: Cell[] }) {
  const byKey = new Map(cells.map((c) => [`${c.weekday}-${c.hour}`, c]));
  const hours = [...new Set(cells.map((c) => c.hour))].sort((a, b) => a - b);
  return (
    <TooltipProvider delayDuration={150}>
      <table className="w-full min-w-[36rem] border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="w-12" />
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col" className="font-medium text-muted-foreground">
                <abbr title={t(`weekdays.${d}`)} className="no-underline">
                  {t(`weekdays.${d}`).slice(0, 3)}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((h) => (
            <tr key={h}>
              <th scope="row" className="text-right font-normal text-muted-foreground tabular-nums">
                {h} h
              </th>
              {WEEKDAYS.map((d) => {
                const cell = byKey.get(`${d}-${h}`);
                if (!cell) return <td key={d} className="h-8 rounded-md bg-muted" />;
                const rate = ratio(cell.seats, cell.capacity);
                const detail = t("kpis.heatCell", {
                  day: t(`weekdays.${d}`),
                  hour: h,
                  seats: cell.seats,
                  capacity: cell.capacity,
                  rate,
                });
                return (
                  <td key={d} className="h-8 p-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          tabIndex={0}
                          aria-label={detail}
                          className="grid h-8 place-items-center rounded-md tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{
                            backgroundColor: `color-mix(in oklab, var(--color-primary) ${Math.max(8, rate)}%, var(--color-card))`,
                            color:
                              rate > 85
                                ? "var(--color-primary-foreground)"
                                : "var(--color-foreground)",
                          }}
                        >
                          {rate} %
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{detail}</TooltipContent>
                    </Tooltip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </TooltipProvider>
  );
}
