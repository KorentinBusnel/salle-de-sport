"use client";

import { ChevronRightIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type HoursRow = {
  coachId: string;
  name: string;
  sessions: number;
  hours: string;
  rate: string;
  amount: string;
  exportHref: string;
  detail: { id: string; day: string; time: string; discipline: string; hours: string }[];
};

/**
 * Heures du mois par coach (Watermelon data-table, lignes dépliables) : chaque ligne s'ouvre
 * sur les séances tenues ; le total reste visible en pied de tableau (collant).
 */
export function HoursTable({
  rows,
  total,
  initialOpen,
}: {
  rows: HoursRow[];
  total: { sessions: number; hours: string; amount: string };
  initialOpen: string | undefined;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set(initialOpen ? [initialOpen] : []));
  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="max-h-[calc(100svh-14rem)] overflow-auto rounded-xl bg-card shadow-border">
      <Table className="min-w-[44rem]">
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10" />
            <TableHead>{t("coaches.name")}</TableHead>
            <TableHead className="text-right">{t("hours.sessions")}</TableHead>
            <TableHead className="text-right">{t("hours.hours")}</TableHead>
            <TableHead className="text-right">{t("hours.rate")}</TableHead>
            <TableHead className="text-right">{t("hours.amount")}</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">{t("hours.export")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const expanded = open.has(row.coachId);
            const detailId = `hours-${row.coachId}`;
            return (
              <Fragment key={row.coachId}>
                <TableRow data-state={expanded ? "open" : undefined}>
                  <TableCell className="pr-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-expanded={expanded}
                      aria-controls={detailId}
                      aria-label={t("hours.showSessions", { name: row.name })}
                      onClick={() => toggle(row.coachId)}
                      disabled={row.detail.length === 0}
                    >
                      <ChevronRightIcon
                        aria-hidden
                        className={cn("transition-transform", expanded && "rotate-90")}
                      />
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/coachs/${row.coachId}`} className="hover:underline">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.sessions}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.hours}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.rate}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {row.amount}
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="icon-sm">
                      <a
                        href={row.exportHref}
                        download
                        aria-label={`${t("hours.export")} : ${row.name}`}
                      >
                        <DownloadIcon aria-hidden />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
                {expanded ? (
                  <TableRow id={detailId} className="bg-muted/30 hover:bg-muted/30">
                    <TableCell />
                    <TableCell colSpan={6} className="py-2">
                      <ul className="grid gap-0.5 text-sm">
                        {row.detail.map((s) => (
                          <li key={s.id} className="flex items-center gap-3 py-1">
                            <span className="w-28 text-muted-foreground">{s.day}</span>
                            <span className="w-28 tabular-nums">{s.time}</span>
                            <span className="flex-1 truncate">{s.discipline}</span>
                            <span className="tabular-nums">{s.hours}</span>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
        <TableFooter className="sticky bottom-0 z-10 bg-muted">
          <TableRow className="hover:bg-transparent">
            <TableCell />
            <TableCell className="font-medium">{t("hours.total")}</TableCell>
            <TableCell className="text-right tabular-nums">{total.sessions}</TableCell>
            <TableCell className="text-right tabular-nums">{total.hours}</TableCell>
            <TableCell />
            <TableCell className="text-right font-medium tabular-nums">{total.amount}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
