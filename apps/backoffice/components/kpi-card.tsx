import { trendChange } from "@salle/shared";
import {
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

/**
 * Carte d'indicateur (medesk, Watermelon widget-9) : libellé et icône en haut, valeur en bas,
 * avec en option la variation par rapport à la période précédente et une courbe.
 */
export function KpiCard({
  label,
  value,
  suffix,
  hint,
  icon: Icon,
  href,
  trend,
  series,
}: {
  label: string;
  value: ReactNode;
  suffix?: ReactNode | undefined;
  hint?: ReactNode | undefined;
  icon: LucideIcon;
  href?: string | undefined;
  /** Valeur actuelle et précédente ; `higherIsBetter: false` pour un indicateur à faire baisser. */
  trend?: { current: number; previous: number | null; higherIsBetter?: boolean } | undefined;
  /** Points de la courbe (du plus ancien au plus récent). */
  series?: number[] | undefined;
}) {
  const change = trend ? trendChange(trend.current, trend.previous) : null;
  const good =
    change && change.direction !== "flat"
      ? (change.direction === "up") === (trend?.higherIsBetter ?? true)
      : null;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Icon aria-hidden className="size-5 text-muted-foreground" />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[1.75rem] leading-none font-medium tabular-nums">
            {value}
            {suffix ? <span className="ml-1 text-lg text-foreground/70">{suffix}</span> : null}
          </p>
          {trend ? <TrendLine change={change} good={good} /> : null}
          {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {series && series.length > 1 ? <Sparkline points={series} /> : null}
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

function TrendLine({
  change,
  good,
}: {
  change: ReturnType<typeof trendChange>;
  good: boolean | null;
}) {
  if (!change) {
    return <p className="mt-2 text-xs text-muted-foreground">{t("forms.trendNone")}</p>;
  }
  const value = percent.format(Math.abs(change.ratio));
  const Arrow =
    change.direction === "up"
      ? ArrowUpRightIcon
      : change.direction === "down"
        ? ArrowDownRightIcon
        : ArrowRightIcon;
  const text =
    change.direction === "flat"
      ? t("forms.trendFlat")
      : t(change.direction === "up" ? "forms.trendUp" : "forms.trendDown", { value });
  return (
    <p
      className={cn(
        "mt-2 inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        good === null ? "text-muted-foreground" : good ? "text-success" : "text-destructive",
      )}
    >
      <Arrow aria-hidden className="size-3.5" />
      <span aria-hidden>
        {change.direction === "flat" ? "=" : `${change.direction === "up" ? "+" : "−"}${value}`}
      </span>
      <span className="sr-only">{text}</span>
    </p>
  );
}

/** Courbe décorative (la valeur et la variation portent l'information). */
function Sparkline({ points }: { points: number[] }) {
  const width = 72;
  const height = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - 2 - ((point - min) / span) * (height - 4);
      return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      className="h-7 w-18 shrink-0 overflow-visible text-primary"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Carte d'indicateur en chargement (section sous Suspense). */
export function KpiCardSkeleton() {
  return (
    <div className="flex min-h-32 flex-col justify-between gap-4 rounded-xl bg-card p-4 shadow-border">
      <div className="flex items-start justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="size-5 rounded-md" />
      </div>
      <div className="grid gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}
