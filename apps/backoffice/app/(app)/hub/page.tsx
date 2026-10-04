import { zonedDateKey, zonedWeek } from "@salle/shared";
import {
  MailIcon,
  MessageCircleIcon,
  NotebookPenIcon,
  PhoneIcon,
  PlusIcon,
  UserPlusIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { BriefCard } from "@/components/assistant/brief-card";
import type { ChatMessage } from "@/components/assistant/use-assistant";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Proposal } from "@/lib/ai/types";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { aiEnv } from "@/lib/env.server";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: t("hub.title") };

const CHANNEL_ICON = {
  email: MailIcon,
  whatsapp: MessageCircleIcon,
  phone: PhoneIcon,
  note: NotebookPenIcon,
} as const;

/**
 * Hub 360° (gérant) : brief de la semaine, assistant Claude, conversations précédentes et
 * fil d'activité de la salle (échanges, messages, nouvelles fiches).
 */
export default async function HubPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const format = gymFormatters(context.gym.timezone);
  const now = currentTime();
  const monday =
    zonedWeek(now, context.gym.timezone).days[0]?.key ?? zonedDateKey(now, context.gym.timezone);
  const supabase = await createClient();

  const [conversations, brief, interactions, newMembers] = await Promise.all([
    supabase
      .from("ai_conversations")
      .select("id, title, updated_at")
      .eq("gym_id", context.gym.id)
      .eq("profile_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(15),
    supabase
      .from("weekly_briefs")
      .select("content, generated_at")
      .eq("gym_id", context.gym.id)
      .eq("week_start", monday)
      .maybeSingle(),
    supabase
      .from("interactions")
      .select(
        "id, channel, direction, subject, summary, occurred_at, members(id, first_name, last_name)",
      )
      .eq("gym_id", context.gym.id)
      .order("occurred_at", { ascending: false })
      .limit(15),
    supabase
      .from("members")
      .select("id, first_name, last_name, created_at")
      .eq("gym_id", context.gym.id)
      .gte("created_at", new Date(now.getTime() - 14 * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const selected = (conversations.data ?? []).find((c) => c.id === params.c);
  let initialMessages: ChatMessage[] = [];
  if (selected) {
    const { data } = await supabase
      .from("ai_messages")
      .select("id, role, content")
      .eq("conversation_id", selected.id)
      .order("created_at");
    initialMessages = (data ?? []).map((m) => {
      const content = m.content as { text?: string; steps?: string[]; proposals?: Proposal[] };
      return {
        id: m.id,
        role: m.role === "user" ? "user" : "assistant",
        text: content.text ?? "",
        steps: content.steps ?? [],
        // Les propositions passées ne sont pas reproposées à la validation.
        proposals: [],
      };
    });
  }

  type Activity = {
    key: string;
    at: string;
    icon: typeof MailIcon;
    title: string;
    href?: string;
    detail?: string;
  };
  const activity: Activity[] = [
    ...(interactions.data ?? []).map((i) => ({
      key: `i-${i.id}`,
      at: i.occurred_at,
      icon: CHANNEL_ICON[i.channel],
      title: `${i.members ? `${i.members.first_name} ${i.members.last_name} · ` : ""}${i.subject ?? t(i.channel === "note" ? "memberProfile.note" : `memberProfile.channel.${i.channel}`)}`,
      ...(i.members ? { href: `/adherents/${i.members.id}` } : {}),
      ...(i.summary ? { detail: i.summary.slice(0, 140) } : {}),
    })),
    ...(newMembers.data ?? []).map((m) => ({
      key: `m-${m.id}`,
      at: m.created_at,
      icon: UserPlusIcon,
      title: t("hub.newMember", { name: `${m.first_name} ${m.last_name}` }),
      href: `/adherents/${m.id}`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 18);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("hub.title")}
        description={t("hub.description")}
        actions={
          <Button asChild variant="outline">
            <Link href="/hub">
              <PlusIcon data-icon="inline-start" />
              {t("assistant.newConversation")}
            </Link>
          </Button>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-6">
          <BriefCard
            content={brief.data?.content ?? null}
            generatedAt={
              brief.data
                ? t("hub.generatedAt", { date: format.dateTime(brief.data.generated_at) })
                : null
            }
            configured={aiEnv().apiKey !== null}
          />
          <Card>
            <CardHeader>
              <CardTitle>{selected?.title || t("assistant.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <AssistantChat
                key={selected?.id ?? "new"}
                conversationId={selected?.id}
                initialMessages={initialMessages}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("assistant.history")}</CardTitle>
            </CardHeader>
            <CardContent className="px-2">
              {conversations.data?.length ? (
                <ul className="grid gap-0.5">
                  {conversations.data.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/hub?c=${c.id}`}
                        aria-current={c.id === selected?.id ? "page" : undefined}
                        className={cn(
                          "grid rounded-lg px-2 py-1.5 text-sm hover:bg-muted",
                          c.id === selected?.id && "bg-accent text-accent-foreground",
                        )}
                      >
                        <span className="truncate">{c.title || t("assistant.title")}</span>
                        <span className="text-xs text-muted-foreground">
                          {format.dateTime(c.updated_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 text-sm text-muted-foreground">{t("assistant.noHistory")}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("hub.activity")}</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("hub.activityEmpty")}</p>
              ) : (
                <ol className="grid gap-3">
                  {activity.map((item) => {
                    const Icon = item.icon;
                    const title = item.href ? (
                      <Link href={item.href} className="font-medium hover:underline">
                        {item.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{item.title}</span>
                    );
                    return (
                      <li key={item.key} className="flex gap-3 text-sm">
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                        </span>
                        <span className="grid min-w-0 gap-0.5">
                          <span className="truncate">{title}</span>
                          {item.detail ? (
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {item.detail}
                            </span>
                          ) : null}
                          <time dateTime={item.at} className="text-xs text-muted-foreground">
                            {format.dateTime(item.at)}
                          </time>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
