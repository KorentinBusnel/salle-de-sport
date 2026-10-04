import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Carte d'indicateur (medesk) : libellé et icône en haut, valeur en bas. */
export function KpiCard({
  label,
  value,
  suffix,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: ReactNode;
  suffix?: ReactNode | undefined;
  hint?: ReactNode | undefined;
  icon: LucideIcon;
  href?: string | undefined;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Icon aria-hidden className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[1.75rem] leading-none font-medium tabular-nums">
          {value}
          {suffix ? <span className="ml-1 text-lg text-foreground/70">{suffix}</span> : null}
        </p>
        {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </>
  );
  const className =
    "flex min-h-32 flex-col justify-between gap-4 rounded-xl bg-card p-4 shadow-border";
  return href ? (
    <Link
      href={href}
      className={cn(
        className,
        "transition-[box-shadow] hover:shadow-border-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      {body}
    </Link>
  ) : (
    <article className={className}>{body}</article>
  );
}
