import { MESSAGE_STATUS_TONE } from "@salle/shared";
import { ChevronRightIcon, MailIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { isManagerRole, requireRole } from "@/lib/auth";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: t("messages.title") };

const ORIGINS = [
  "session_cancelled",
  "session_moved",
  "coach_changed",
  "campaign",
  "automation",
] as const;
const STATUSES = ["queued", "logged", "sent", "failed"] as const;
const PAGE_SIZE = 30;

/** Journal de la file d'envoi : avis aux inscrits, campagnes, automatisations. */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ origine?: string; statut?: string; page?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const format = gymFormatters(context.gym.timezone);
  const origin = ORIGINS.find((o) => o === params.origine);
  const status = STATUSES.find((s) => s === params.statut);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("outbound_messages")
    .select(
      "id, subject, body, status, origin, to_address, created_at, members(id, first_name, last_name)",
      { count: "exact" },
    )
    .eq("gym_id", context.gym.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (origin) query = query.eq("origin", origin);
  if (status) query = query.eq("status", status);
  const { data: messages, count, error } = await query;
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (overrides: { page?: number }) => {
    const search = new URLSearchParams();
    if (origin) search.set("origine", origin);
    if (status) search.set("statut", status);
    if ((overrides.page ?? 1) > 1) search.set("page", String(overrides.page));
    const text = search.toString();
    return `/messages${text ? `?${text}` : ""}`;
  };

  return (
    <div className="grid gap-6">
      <PageHeader title={t("messages.title")} description={t("messages.count", { count: total })} />
      <p className="max-w-2xl text-sm text-muted-foreground">{t("messages.noDelivery")}</p>

      <form className="flex flex-wrap items-end gap-3" aria-label={t("messages.filters")}>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t("messages.origin")}</span>
          <NativeSelect name="origine" defaultValue={origin ?? ""}>
            <NativeSelectOption value="">{t("messages.allOrigins")}</NativeSelectOption>
            {ORIGINS.map((o) => (
              <NativeSelectOption key={o} value={o}>
                {t(`messages.origins.${o}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t("messages.status")}</span>
          <NativeSelect name="statut" defaultValue={status ?? ""}>
            <NativeSelectOption value="">{t("messages.allStatuses")}</NativeSelectOption>
            {STATUSES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {t(`messages.statuses.${s}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit" variant="outline">
          {t("messages.filter")}
        </Button>
      </form>

      {!messages?.length ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailIcon />
            </EmptyMedia>
            <EmptyTitle>{t("messages.empty")}</EmptyTitle>
            <EmptyDescription>{t("messages.emptyHint")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl bg-card shadow-border">
          {messages.map((message) => {
            const name = message.members
              ? `${message.members.first_name} ${message.members.last_name}`
              : t("common.none");
            return (
              <li key={message.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                    <ChevronRightIcon
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                    />
                    <span className="grid min-w-0 flex-1 basis-64">
                      <span className="truncate font-medium">{message.subject}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {name}
                        {message.to_address ? ` · ${message.to_address}` : ""}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`messages.origins.${message.origin}`)}
                    </span>
                    <StatusPill tone={MESSAGE_STATUS_TONE[message.status]}>
                      {t(`messages.statuses.${message.status}`)}
                    </StatusPill>
                    <time
                      dateTime={message.created_at}
                      className="w-28 text-right text-xs text-muted-foreground tabular-nums"
                    >
                      {format.dateTime(message.created_at)}
                    </time>
                  </summary>
                  <div className="grid gap-3 border-t bg-muted/30 px-4 py-4 pl-12 text-sm">
                    <p className="max-w-prose whitespace-pre-line">{message.body}</p>
                    {message.to_address ? null : (
                      <p className="text-xs text-muted-foreground">{t("messages.noAddress")}</p>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label={t("ui.pagination")}>
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn(page <= 1 && "pointer-events-none opacity-50")}
          >
            <Link href={href({ page: page - 1 })} aria-disabled={page <= 1}>
              {t("ui.previous")}
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("members.page", { page, pages })}
          </span>
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn(page >= pages && "pointer-events-none opacity-50")}
          >
            <Link href={href({ page: page + 1 })} aria-disabled={page >= pages}>
              {t("ui.next")}
            </Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
