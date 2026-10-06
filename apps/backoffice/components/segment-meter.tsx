import { TONE_CLASSES, type Tone } from "@salle/shared";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type MeterSegment = { label: string; value: number; tone: Tone };

/**
 * Barre segmentée avec légende (Watermelon widget-2) : places prises / liste d'attente /
 * libres, crédits utilisés / restants… Le total vaut au moins la somme des segments.
 */
export function SegmentMeter({
  label,
  segments,
  total,
  legend = true,
  className,
}: {
  label: string;
  segments: MeterSegment[];
  total?: number | undefined;
  legend?: boolean | undefined;
  className?: string | undefined;
}) {
  const sum = segments.reduce((acc, segment) => acc + Math.max(0, segment.value), 0);
  const max = Math.max(total ?? sum, sum, 1);
  const summary = segments.map((segment) => `${segment.label} : ${segment.value}`).join(", ");
  return (
    <figure className={cn("grid gap-2", className)}>
      <div
        role="img"
        aria-label={`${label} — ${summary}${total !== undefined ? ` (${t("forms.meterTotal", { value: sum, total })})` : ""}`}
        className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
      >
        {segments.map((segment) =>
          segment.value > 0 ? (
            <span
              key={segment.label}
              className={cn(
                "h-full transition-[width] duration-300 ease-out first:rounded-l-full last:rounded-r-full motion-reduce:transition-none",
                TONE_CLASSES[segment.tone].dot,
              )}
              style={{ width: `${(segment.value / max) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      {legend ? (
        <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {segments.map((segment) => (
            <span key={segment.label} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("size-2 rounded-full", TONE_CLASSES[segment.tone].dot)}
              />
              {segment.label}
              <span className="font-medium text-foreground tabular-nums">{segment.value}</span>
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}
