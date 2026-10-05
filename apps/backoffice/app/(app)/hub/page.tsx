import { CONNECTED_DIGEST_SOURCES, DIGEST_SOURCES, openDigestItems } from "@salle/shared";
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import type { ChatMessage } from "@/components/assistant/use-assistant";
import { AskBar } from "@/components/hub/ask-bar";
import { DigestBoard } from "@/components/hub/digest-board";
import { GenerateDigestButton } from "@/components/hub/generate-digest-button";
import { SOURCE_ICON } from "@/components/hub/source-icon";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { isManagerRole, requireRole } from "@/lib/auth";
import { getTodayDigest } from "@/lib/digest";
import { aiEnv } from "@/lib/env.server";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: t("hub.title") };

const CONNECTED = new Set<string>(CONNECTED_DIGEST_SOURCES);

/**
 * Hub 360° (gérant) : l'assistant lit l'activité de la salle et propose, par catégorie
 * (Opérations, Clients, Finance), une synthèse et des actions à valider ; question libre et
 * conversations précédentes.
 */
export default async function HubPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const format = gymFormatters(context.gym.timezone);
  const configured = aiEnv().apiKey !== null;
  const supabase = await createClient();

  const [digest, conversations] = await Promise.all([
    getTodayDigest(context),
    supabase
      .from("ai_conversations")
      .select("id, title, updated_at")
      .eq("gym_id", context.gym.id)
      .eq("profile_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(12),
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
      const content = m.content as { text?: string; steps?: string[] };
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

  const open = digest ? openDigestItems(digest).length : 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("hub.title")}
        description={
          digest
            ? `${t("hub.actionsCount", { count: open })} · ${t("hub.generatedAt", { time: format.time(digest.generatedAt) })}`
            : t("hub.description")
        }
        actions={
          <>
            {configured && digest ? <GenerateDigestButton again variant="outline" /> : null}
            <Button asChild variant="outline">
              <Link href="/hub">
                <PlusIcon data-icon="inline-start" />
                {t("assistant.newConversation")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted-foreground">{t("hub.sourcesLabel")}</span>
        {DIGEST_SOURCES.map((source) => {
          const Icon = SOURCE_ICON[source];
          const connected = CONNECTED.has(source);
          return (
            <span
              key={source}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs shadow-border",
                connected ? "bg-card" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              <span className="font-medium">{t(`hub.source.${source}`)}</span>
              <span className={connected ? "text-success" : undefined}>
                {t(connected ? "hub.sourceConnected" : "hub.sourcePending")}
              </span>
            </span>
          );
        })}
        <Link
          href="/parametres?onglet=integrations"
          className="ml-1 text-sm font-medium text-primary hover:underline"
        >
          {t("hub.manageSources")}
        </Link>
      </div>

      {configured ? (
        <AskBar />
      ) : (
        <div className="grid gap-3 rounded-xl border border-dashed p-6 text-center text-sm">
          <p>{t("assistant.notConfigured")}</p>
          <Button asChild variant="outline" className="mx-auto w-fit">
            <Link href="/parametres?onglet=integrations">{t("assistant.openSettings")}</Link>
          </Button>
        </div>
      )}

      {digest ? (
        <DigestBoard digest={digest} />
      ) : configured ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("hub.empty")}</EmptyTitle>
            <EmptyDescription>{t("hub.emptyHint")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <GenerateDigestButton again={false} />
          </EmptyContent>
        </Empty>
      ) : null}

      {configured ? (
        <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{t("hub.conversations")}</CardTitle>
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
      ) : null}
    </div>
  );
}
