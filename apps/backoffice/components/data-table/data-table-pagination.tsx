import { PageSizeSelect } from "@/components/data-table/page-size-select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { t } from "@/lib/i18n";
import { type PageSize, pageWindow } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * Pied de tableau (Watermelon pagination-12) : plage affichée, lignes par page, pages
 * voisines et coupures. `hrefFor` construit le lien d'une page.
 */
export function DataTablePagination({
  page,
  pages,
  total,
  size,
  hrefFor,
}: {
  page: number;
  pages: number;
  total: number;
  size: PageSize;
  hrefFor: (page: number) => string;
}) {
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {t("table.range", { from, to, total })}
        </p>
        <PageSizeSelect value={size} />
      </div>
      {pages > 1 ? (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={hrefFor(Math.max(1, page - 1))}
                aria-disabled={page <= 1}
                className={cn(page <= 1 && "pointer-events-none opacity-50")}
              />
            </PaginationItem>
            {pageWindow(page, pages).map((entry, index) =>
              entry === "gap" ? (
                <PaginationItem key={`gap-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={entry}>
                  <PaginationLink href={hrefFor(entry)} isActive={entry === page}>
                    {entry}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                href={hrefFor(Math.min(pages, page + 1))}
                aria-disabled={page >= pages}
                className={cn(page >= pages && "pointer-events-none opacity-50")}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
