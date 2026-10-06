"use client";

import { MessageSquareIcon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import type { ChatMessage } from "@/components/assistant/use-assistant";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ConversationItem = { id: string; title: string; when: string };

const HUB_ASK_EVENT = "salle:hub-ask";

/** Pose une question dans une nouvelle conversation du Hub (barre « Demander » du haut). */
export function askInHub(question: string) {
  window.dispatchEvent(new CustomEvent<string>(HUB_ASK_EVENT, { detail: question }));
}

type View = { key: string; id: string | undefined; messages: ChatMessage[]; ask?: string };

/**
 * Hub en deux volets (d'après mail-dashboard) : conversations à gauche, fil à droite. Changer de
 * conversation lit ses messages par /api/assistant/conversations/[id] (sans rendu serveur) et
 * met l'URL à jour (`?c=`), le bouton Précédent du navigateur compris.
 */
export function HubConversations({
  conversations: initialList,
  selectedId,
  initialMessages,
}: {
  conversations: ConversationItem[];
  selectedId: string | undefined;
  initialMessages: ChatMessage[];
}) {
  const [list, setList] = useState(initialList);
  const [view, setView] = useState<View>({
    key: selectedId ?? "new",
    id: selectedId,
    messages: initialMessages,
  });
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useRef<AbortController | null>(null);
  const pane = useRef<HTMLDivElement>(null);

  const open = useCallback(async (id: string | undefined, push: boolean) => {
    request.current?.abort();
    setFailed(false);
    if (push) window.history.pushState(null, "", id ? `/hub?c=${id}` : "/hub");
    if (!id) {
      setLoadingId(null);
      setView({ key: `new:${crypto.randomUUID()}`, id: undefined, messages: [] });
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setLoadingId(id);
    try {
      const response = await fetch(`/api/assistant/conversations/${id}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as { messages: ChatMessage[] };
      setView({ key: id, id, messages: data.messages });
    } catch {
      if (controller.signal.aborted) return;
      setFailed(true);
    } finally {
      if (request.current === controller) setLoadingId(null);
    }
  }, []);

  // Précédent / Suivant du navigateur : la conversation suit l'URL.
  useEffect(() => {
    function onPop() {
      const id = new URLSearchParams(window.location.search).get("c") ?? undefined;
      void open(id, false);
    }
    function onAsk(event: Event) {
      const question = (event as CustomEvent<string>).detail;
      window.history.pushState(null, "", "/hub");
      request.current?.abort();
      setLoadingId(null);
      setView({ key: `new:${crypto.randomUUID()}`, id: undefined, messages: [], ask: question });
      pane.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    window.addEventListener("popstate", onPop);
    window.addEventListener(HUB_ASK_EVENT, onAsk);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener(HUB_ASK_EVENT, onAsk);
    };
  }, [open]);

  // Nouvelle conversation créée par la première question : en tête de liste, dans l'URL.
  const onConversation = useCallback(
    (id: string, firstQuestion: string) => {
      setView((current) => (current.id === id ? current : { ...current, id }));
      if (list.some((c) => c.id === id)) return;
      window.history.replaceState(null, "", `/hub?c=${id}`);
      setList((current) =>
        current.some((c) => c.id === id)
          ? current
          : [{ id, title: firstQuestion.slice(0, 120), when: t("hub.justNow") }, ...current],
      );
    },
    [list],
  );

  const activeId = loadingId ?? view.id;
  const title = list.find((c) => c.id === view.id)?.title || t("assistant.title");

  return (
    <div
      ref={pane}
      className="grid scroll-mt-20 items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]"
    >
      <nav
        aria-label={t("hub.conversations")}
        className="grid gap-2 rounded-xl bg-card p-2 shadow-border lg:sticky lg:top-20"
      >
        <Button
          variant="outline"
          className="justify-start"
          onClick={() => void open(undefined, true)}
        >
          <PlusIcon data-icon="inline-start" />
          {t("assistant.newConversation")}
        </Button>
        {list.length ? (
          <ul className="grid max-h-[60svh] gap-0.5 overflow-y-auto">
            {list.map((c) => (
              <li key={c.id}>
                <a
                  href={`/hub?c=${c.id}`}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
                      return;
                    event.preventDefault();
                    if (c.id !== view.id || failed) void open(c.id, true);
                  }}
                  aria-current={c.id === activeId ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted pointer-coarse:min-h-10",
                    c.id === activeId && "bg-accent text-accent-foreground hover:bg-accent",
                  )}
                >
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate">{c.title || t("assistant.title")}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{c.when}</span>
                  </span>
                  {c.id === loadingId ? <Spinner className="shrink-0" /> : null}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 py-1 text-sm text-muted-foreground">{t("assistant.noHistory")}</p>
        )}
      </nav>

      <section
        aria-label={title}
        aria-busy={loadingId !== null}
        className="flex h-[min(44rem,calc(100svh-6rem))] min-h-[26rem] flex-col rounded-xl bg-card shadow-border"
      >
        <header className="flex min-h-12 items-center gap-2 border-b px-4 py-2">
          <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <h2 className="truncate text-sm font-medium">{title}</h2>
        </header>
        {failed ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            {t("hub.conversationFailed")}
          </p>
        ) : null}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col transition-opacity",
            loadingId !== null && "opacity-50",
          )}
        >
          <AssistantChat
            key={view.key}
            conversationId={view.id}
            initialMessages={view.messages}
            autoAsk={view.ask}
            fill
            onConversation={onConversation}
          />
        </div>
      </section>
    </div>
  );
}
