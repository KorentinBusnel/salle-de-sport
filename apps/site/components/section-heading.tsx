import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
  centered = false,
  className,
}: {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  centered?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(centered && "mx-auto max-w-hero text-center", className)}>
      <p className="text-lg font-semibold text-primary">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-lg leading-9 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** Largeur et marges communes des sections. */
export const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6";
