"use client";

import {
  CalendarClockIcon,
  CalendarXIcon,
  ChevronRightIcon,
  MailPlusIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import {
  deleteCampaignQuick,
  sendCampaignNow,
  setCampaignSchedule,
} from "@/app/(app)/emailing/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RowActionsMenu, type RowAction } from "@/components/data-table/row-actions-menu";
import { CampaignSheet, type CampaignDraft } from "@/components/emailing/campaign-sheet";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { t } from "@/lib/i18n";
import { toastUndo } from "@/lib/toast-undo";
import { cn } from "@/lib/utils";

const STATUS_TONE = {
  draft: "neutral",
  scheduled: "brand",
  sending: "warning",
  sent: "success",
  cancelled: "danger",
} as const;

export type CampaignStatus = keyof typeof STATUS_TONE;

export type CampaignRow = CampaignDraft & {
  status: CampaignStatus;
  segmentName: string | null;
  subject: string;
  body: string;
  /** Instant de programmation (ISO), pour « Annuler » un retour en brouillon. */
  scheduledAt: string | null;
  /** Date affichée : programmée, envoyée ou créée. */
  dateLabel: string;
  audience: { targeted: number; reachable: number } | null;
  stats: { queued: number; targeted: number; excluded: number } | null;
};

/**
 * Campagnes en tableau (Watermelon data-table, lignes dépliables) : nom et objet, statut,
 * segment, audience joignable, date ; menu « … » (modifier, envoyer, repasser en brouillon,
 * supprimer). Création et modification dans un panneau latéral ; envoi et suppression
 * confirmés (case « Je comprends » pour l'envoi).
 */
export function CampaignsBoard({
  campaigns,
  segments,
  templates,
  todayKey,
  openNew,
}: {
  campaigns: CampaignRow[];
  segments: { id: string; name: string }[];
  templates: { id: string; name: string; subject: string }[];
  todayKey: string;
  openNew: boolean;
}) {
  const router = useRouter();
  const ready = segments.length > 0 && templates.length > 0;
  const [sheet, setSheet] = useState<{ open: boolean; campaign: CampaignRow | null }>({
    open: openNew && ready,
    campaign: null,
  });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ kind: "send" | "delete"; row: CampaignRow } | null>(
    null,
  );

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function unschedule(row: CampaignRow) {
    toastUndo({
      message: t("emailing.campaignUnscheduled"),
      mode: "inverse",
      run: async () => {
        const result = await setCampaignSchedule(row.id, null);
        return { error: result.ok ? null : result.error };
      },
      undo: async () => {
        const result = await setCampaignSchedule(row.id, row.scheduledAt);
        return { error: result.ok ? null : result.error };
      },
      onSettled: () => router.refresh(),
    });
  }

  async function runConfirmed() {
    if (!confirm) return;
    const { kind, row } = confirm;
    const result =
      kind === "send" ? await sendCampaignNow(row.id) : await deleteCampaignQuick(row.id);
    if (!result.ok) {
      toast.error(t(result.error), { closeButton: true });
      return;
    }
    if (result.message) toast.success(t(result.message, { count: result.count ?? 0 }));
    setConfirm(null);
    router.refresh();
  }

  function actionsFor(row: CampaignRow): RowAction[] {
    if (row.status !== "draft" && row.status !== "scheduled") return [];
    return [
      {
        label: t("emailing.editCampaign"),
        icon: PencilIcon,
        onSelect: () => setSheet({ open: true, campaign: row }),
      },
      {
        label: t("emailing.sendNow"),
        icon: SendIcon,
        onSelect: () => setConfirm({ kind: "send", row }),
      },
      ...(row.status === "scheduled"
        ? [
            {
              label: t("emailing.unschedule"),
              icon: CalendarXIcon,
              onSelect: () => unschedule(row),
            },
          ]
        : [
            {
              label: t("emailing.schedule"),
              icon: CalendarClockIcon,
              onSelect: () => setSheet({ open: true, campaign: row }),
            },
          ]),
      {
        label: t("emailing.deleteCampaign"),
        icon: Trash2Icon,
        destructive: true,
        separated: true,
        onSelect: () => setConfirm({ kind: "delete", row }),
      },
    ];
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("emailing.campaignCount", { count: campaigns.length })}
        </p>
        {ready ? (
          <Button onClick={() => setSheet({ open: true, campaign: null })}>
            <MailPlusIcon data-icon="inline-start" />
            {t("emailing.newCampaign")}
          </Button>
        ) : null}
      </div>

      {!ready ? (
        <p className="rounded-xl bg-muted/60 px-4 py-3 text-sm">
          {t("emailing.needSegmentAndTemplate")}{" "}
          <Link href="/segments" className="font-medium underline">
            {t("nav.segments")}
          </Link>{" "}
          ·{" "}
          <Link href="/emailing/modeles" className="font-medium underline">
            {t("emailing.tab.templates")}
          </Link>
        </p>
      ) : null}

      {campaigns.length === 0 ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailPlusIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{t("emailing.noCampaign")}</EmptyTitle>
            <EmptyDescription>{t("emailing.noCampaignHint")}</EmptyDescription>
          </EmptyHeader>
          {ready ? (
            <EmptyContent>
              <Button onClick={() => setSheet({ open: true, campaign: null })}>
                {t("emailing.newCampaign")}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card shadow-border">
          <Table className="min-w-[46rem]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-10" />
                <TableHead>{t("emailing.campaignName")}</TableHead>
                <TableHead>{t("emailing.statusLabel")}</TableHead>
                <TableHead>{t("emailing.segment")}</TableHead>
                <TableHead className="text-right">{t("emailing.reachable")}</TableHead>
                <TableHead>{t("emailing.dateLabel")}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t("table.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((row) => {
                const open = expanded.has(row.id);
                const detailsId = `campaign-${row.id}`;
                return (
                  <Fragment key={row.id}>
                    <TableRow data-state={open ? "open" : undefined}>
                      <TableCell className="pr-0">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-expanded={open}
                          aria-controls={detailsId}
                          aria-label={t("emailing.showContent", { name: row.name })}
                          onClick={() => toggle(row.id)}
                        >
                          <ChevronRightIcon
                            aria-hidden
                            className={cn("transition-transform", open && "rotate-90")}
                          />
                        </Button>
                      </TableCell>
                      <TableCell className="max-w-72">
                        <span className="block truncate font-medium">{row.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.subject}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusPill tone={STATUS_TONE[row.status]}>
                          {t(`emailing.status.${row.status}`)}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        {row.segmentId ? (
                          <Link
                            href={`/segments?segment=${row.segmentId}`}
                            className="hover:underline"
                          >
                            {row.segmentName ?? t("emailing.deletedSegment")}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.stats
                          ? `${row.stats.queued} / ${row.stats.targeted}`
                          : row.audience
                            ? `${row.audience.reachable} / ${row.audience.targeted}`
                            : "—"}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
                        {row.dateLabel}
                      </TableCell>
                      <TableCell>
                        <RowActionsMenu label={row.name} actions={actionsFor(row)} />
                      </TableCell>
                    </TableRow>
                    {open ? (
                      <TableRow id={detailsId} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell />
                        <TableCell colSpan={6} className="py-4 whitespace-normal">
                          <div className="grid max-w-prose gap-2 rounded-lg bg-card p-4 text-sm shadow-border">
                            <p className="font-semibold">{row.subject}</p>
                            <p className="whitespace-pre-line text-muted-foreground">{row.body}</p>
                          </div>
                          {row.stats ? (
                            <p className="mt-3 text-xs text-muted-foreground">
                              {t("emailing.statsLine", {
                                queued: row.stats.queued,
                                targeted: row.stats.targeted,
                                excluded: row.stats.excluded,
                              })}
                            </p>
                          ) : null}
                          {row.status === "cancelled" ? (
                            <p className="mt-3 text-xs text-destructive">
                              {t("emailing.cancelledHint")}
                            </p>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CampaignSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        campaign={sheet.campaign}
        segments={segments}
        templates={templates}
        todayKey={todayKey}
      />

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.kind === "send"
            ? t("emailing.sendTitle", { name: confirm.row.name })
            : t("emailing.deleteTitle", { name: confirm?.row.name ?? "" })
        }
        description={
          confirm?.kind === "send"
            ? t("emailing.sendBody", { count: confirm.row.audience?.reachable ?? 0 })
            : t("emailing.deleteBody")
        }
        confirmLabel={t(confirm?.kind === "send" ? "emailing.sendNow" : "common.delete")}
        tone={confirm?.kind === "send" ? "default" : "destructive"}
        requireAck={confirm?.kind === "send" ? t("emailing.sendAck") : undefined}
        action={runConfirmed}
      />
    </div>
  );
}
