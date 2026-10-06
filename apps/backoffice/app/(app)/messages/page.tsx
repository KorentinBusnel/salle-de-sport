import type { Metadata } from "next";
import { MailIcon } from "lucide-react";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { MessagesFilters } from "@/components/messages/messages-filters";
import { type MessageRow, MessagesList } from "@/components/messages/messages-list";
import { EmailingNav } from "@/components/emailing-nav";
import { PageHeader } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PendingRegion, UrlStateProvider } from "@/hooks/use-url-state";
import { isManagerRole, requireRole } from "@/lib/auth";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { pageSizeOf } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("messages.title") };

const ORIGINS = [
  "session_cancelled",
  "session_moved",
  "coach_changed",
  "campaign",
  "automation",
  "direct",
  "billing",
] as const;
const STATUSES = ["queued", "logged", "sent", "failed"] as const;

/** Échappe les jokers d'un motif ilike et les séparateurs du filtre `or` de PostgREST. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()]/g, " ")}%`;
}

/**
 * Journal de la file d'envoi (avis aux inscrits, campagnes, automatisations) : filtres et
 * recherche appliqués aussitôt, pagination 25 / 50 / 100, détail dans un panneau latéral.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    origine?: string;
    statut?: string;
    page?: string;
    taille?: string;
    q?: string;
    adherent?: string;
  }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const format = gymFormatters(context.gym.timezone);
  const origin = ORIGINS.find((o) => o === params.origine) ?? null;
  const status = STATUSES.find((s) => s === params.statut) ?? null;
  const search = (params.q ?? "").trim().slice(0, 80);
  const memberId = /^[0-9a-f-]{36}$/i.test(params.adherent ?? "") ? params.adherent! : null;
  const size = pageSizeOf(params.taille);
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
    .range((page - 1) * size, page * size - 1);
  if (origin) query = query.eq("origin", origin);
  if (status) query = query.eq("status", status);
  if (memberId) query = query.eq("member_id", memberId);
  if (search) {
    const pattern = likePattern(search);
    query = query.or(`subject.ilike.${pattern},to_address.ilike.${pattern}`);
  }
  const [{ data: messages, count, error }, { data: member }] = await Promise.all([
    query,
    memberId
      ? supabase
          .from("members")
          .select("id, first_name, last_name")
          .eq("id", memberId)
          .eq("gym_id", context.gym.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));

  const rows: MessageRow[] = (messages ?? []).map((m) => ({
    id: m.id,
    subject: m.subject,
    body: m.body,
    status: m.status,
    origin: m.origin,
    toAddress: m.to_address,
    when: format.dateTime(m.created_at),
    createdAt: m.created_at,
    member: m.members
      ? { id: m.members.id, name: `${m.members.first_name} ${m.members.last_name}` }
      : null,
  }));

  const href = (target: number) => {
    const next = new URLSearchParams();
    if (origin) next.set("origine", origin);
    if (status) next.set("statut", status);
    if (search) next.set("q", search);
    if (memberId) next.set("adherent", memberId);
    if (params.taille) next.set("taille", String(size));
    if (target > 1) next.set("page", String(target));
    const text = next.toString();
    return `/messages${text ? `?${text}` : ""}`;
  };
  const filtered = Boolean(origin || status || search || memberId);

  return (
    <UrlStateProvider>
      <div className="grid gap-6">
        <PageHeader
          title={t("messages.title")}
          description={t("messages.count", { count: total })}
        />
        <EmailingNav current="/messages" />
        <p className="max-w-2xl text-sm text-muted-foreground">{t("messages.noDelivery")}</p>

        <MessagesFilters
          origins={ORIGINS}
          statuses={STATUSES}
          initial={{
            q: search,
            origin,
            status,
            member: member
              ? { id: member.id, name: `${member.first_name} ${member.last_name}` }
              : null,
          }}
        />

        <PendingRegion>
          {rows.length === 0 ? (
            <Empty className="rounded-xl border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MailIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle>{t("messages.empty")}</EmptyTitle>
                <EmptyDescription>
                  {filtered ? t("messages.emptyFiltered") : t("messages.emptyHint")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <MessagesList messages={rows} />
          )}
        </PendingRegion>

        {total > 0 ? (
          <DataTablePagination page={page} pages={pages} total={total} size={size} hrefFor={href} />
        ) : null}
      </div>
    </UrlStateProvider>
  );
}
