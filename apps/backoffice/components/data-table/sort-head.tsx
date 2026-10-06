import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import Link from "next/link";
import { TableHead } from "@/components/ui/table";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** En-tête triable : lien vers le tri suivant, état annoncé par `aria-sort`. */
export function SortHead({
  label,
  href,
  direction,
  col,
  className,
}: {
  label: string;
  /** Lien qui applique le tri suivant (ou l'inverse du tri actuel). */
  href: string;
  direction: "asc" | "desc" | null;
  /** Colonne masquable (`data-col`). */
  col?: string | undefined;
  className?: string | undefined;
}) {
  const Icon =
    direction === "asc" ? ArrowUpIcon : direction === "desc" ? ArrowDownIcon : ArrowUpDownIcon;
  return (
    <TableHead
      data-col={col}
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
      className={className}
    >
      <Link
        href={href}
        scroll={false}
        className={cn(
          "-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          direction && "text-foreground",
        )}
      >
        {label}
        <Icon aria-hidden className={cn("size-3.5", !direction && "opacity-40")} />
        <span className="sr-only">{t("table.sortBy", { label })}</span>
      </Link>
    </TableHead>
  );
}
