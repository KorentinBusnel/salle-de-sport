"use client";

import type { MemberStatus } from "@salle/shared";
import { DownloadIcon, TagIcon, UserCheckIcon, XIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { bulkActivate, bulkAddTag } from "@/app/(app)/adherents/actions";
import { useSelection } from "@/components/data-table/selection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";

/**
 * Barre d'actions sur la sélection (Watermelon data-table-12) : activer les inscriptions,
 * ajouter une étiquette, exporter en CSV (gérant, journalisé). Pas de message en masse :
 * les envois passent par l'emailing, qui vérifie les consentements.
 */
export function MembersBulkBar({
  statuses,
  canExport,
}: {
  /** Statut des fiches de la page (pour compter les inscriptions à activer). */
  statuses: Record<string, MemberStatus>;
  canExport: boolean;
}) {
  const selection = useSelection();
  const [pending, startTransition] = useTransition();
  const [tagOpen, setTagOpen] = useState(false);
  const [tag, setTag] = useState("");
  const tagId = useId();
  const ids = [...(selection?.selected ?? [])];
  if (!selection || ids.length === 0) return null;
  const prospects = ids.filter((id) => statuses[id] === "prospect");

  const report = (result: Awaited<ReturnType<typeof bulkActivate>>) => {
    if (!result.ok) toast.error(t(result.error), { closeButton: true });
    else if (result.message) toast.success(t(result.message, { count: result.count ?? 0 }));
  };

  function exportCsv() {
    startTransition(async () => {
      const response = await fetch("/api/adherents/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) {
        toast.error(t("common.unexpectedError"), { closeButton: true });
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `adherents-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(t("members.bulk.exported", { count: ids.length }));
    });
  }

  return (
    <div
      role="toolbar"
      aria-label={t("members.bulk.toolbar")}
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center gap-2 rounded-2xl bg-popover p-2 pl-4 shadow-border-hover"
    >
      <span className="text-sm font-medium tabular-nums" aria-live="polite">
        {t("members.bulk.selected", { count: ids.length })}
      </span>
      {pending ? <Spinner /> : null}
      {prospects.length ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              report(await bulkActivate({ memberIds: prospects }));
              selection.clear();
            })
          }
        >
          <UserCheckIcon data-icon="inline-start" aria-hidden />
          {t("members.bulk.activate", { count: prospects.length })}
        </Button>
      ) : null}
      <Popover open={tagOpen} onOpenChange={setTagOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" disabled={pending}>
            <TagIcon data-icon="inline-start" aria-hidden />
            {t("members.bulk.tag")}
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-72">
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const value = tag.trim();
              if (!value) return;
              setTagOpen(false);
              startTransition(async () => {
                report(await bulkAddTag({ memberIds: ids, tag: value }));
                setTag("");
              });
            }}
          >
            <label htmlFor={tagId} className="text-sm font-medium">
              {t("members.bulk.tagLabel", { count: ids.length })}
            </label>
            <Input
              id={tagId}
              value={tag}
              maxLength={40}
              placeholder={t("forms.tagPlaceholder")}
              onChange={(event) => setTag(event.target.value)}
            />
            <Button type="submit" size="sm" className="justify-self-end" disabled={!tag.trim()}>
              {t("members.bulk.tagSubmit")}
            </Button>
          </form>
        </PopoverContent>
      </Popover>
      {canExport ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={exportCsv}>
          <DownloadIcon data-icon="inline-start" aria-hidden />
          {t("members.bulk.export")}
        </Button>
      ) : null}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t("members.bulk.clear")}
        onClick={selection.clear}
      >
        <XIcon aria-hidden />
      </Button>
    </div>
  );
}
