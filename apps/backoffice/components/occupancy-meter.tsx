import { occupancy } from "@salle/shared";
import { cn } from "@/lib/utils";

/** Jauge d'occupation (places prises / capacité), complète en couleur d'alerte. */
export function OccupancyMeter({
  booked,
  capacity,
  label,
  className,
}: {
  booked: number;
  capacity: number;
  label: string;
  className?: string | undefined;
}) {
  const ratio = occupancy(capacity, booked);
  const full = capacity > 0 && booked >= capacity;
  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={capacity}
      aria-valuenow={booked}
      aria-label={label}
      className={cn("block h-2 w-24 overflow-hidden rounded-full bg-muted", className)}
    >
      <span
        className={cn(
          "block h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none",
          full ? "bg-warning" : "bg-primary",
        )}
        style={{ width: `${ratio * 100}%` }}
      />
    </span>
  );
}
