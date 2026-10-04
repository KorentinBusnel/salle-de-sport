import { TONE_CLASSES, type Tone } from "@salle/shared";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Pastille de statut « soft » à point coloré (Watermelon), sur les tons de packages/shared. */
export function StatusPill({
  tone,
  children,
  className,
  dot = true,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string | undefined;
  dot?: boolean | undefined;
}) {
  const classes = TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        classes.pill,
        className,
      )}
    >
      {dot ? <span aria-hidden className={cn("size-1.5 rounded-full", classes.dot)} /> : null}
      {children}
    </span>
  );
}

/** Puce de discipline : couleur venue de la base, en teinte légère. */
export function DisciplineChip({ name, color }: { name: string; color: string | undefined }) {
  const base = color ?? "var(--color-neutral-500)";
  return (
    <span
      className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium"
      style={{ backgroundColor: `color-mix(in oklab, ${base} 12%, transparent)` }}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: base }} />
      <span className="text-foreground">{name}</span>
    </span>
  );
}
