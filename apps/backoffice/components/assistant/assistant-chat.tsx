"use client";

import {
  ArrowUpIcon,
  CheckIcon,
  LoaderIcon,
  MailIcon,
  FilterIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { approveMessage, approveSegment } from "@/app/(app)/hub/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Proposal } from "@/lib/ai/types";
import { type MessageKey, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { type ChatMessage, useAssistant } from "./use-assistant";

const SUGGESTIONS = [
  "assistant.suggestions.week",
  "assistant.suggestions.churn",
  "assistant.suggestions.fill",
  "assistant.suggestions.noShows",
] as const satisfies readonly MessageKey[];

/**
 * Conversation avec l'assistant : fil des questions et réponses (Markdown, liens internes),
 * étapes en cours, cartes de propositions à valider, saisie (Entrée pour envoyer).
 */
export function AssistantChat({
  conversationId,
  initialMessages,
  memberId,
  autoAsk,
  compact = false,
  onConversation,
}: {
  conversationId?: string | undefined;
  initialMessages?: ChatMessage[] | undefined;
  memberId?: string | undefined;
  /** Question posée dès l'affichage (résumé d'une fiche adhérent). */
  autoAsk?: string | undefined;
  compact?: boolean | undefined;
  onConversation?: ((id: string) => void) | undefined;
}) {
  const assistant = useAssistant({
    conversationId,
    initialMessages: initialMessages ?? [],
    memberId,
  });
  const [draft, setDraft] = useState("");
  const asked = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const { ask, conversationId: currentId } = assistant;

  useEffect(() => {
    if (autoAsk && !asked.current) {
      asked.current = true;
      void ask(autoAsk);
    }
  }, [autoAsk, ask]);
  useEffect(() => {
    if (currentId) onConversation?.(currentId);
  }, [currentId, onConversation]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [assistant.messages]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const question = draft;
    setDraft("");
    void ask(question);
  }

  if (assistant.status === "not_configured") {
    return (
      <div className="grid gap-3 rounded-xl border border-dashed p-6 text-center text-sm">
        <p>{t("assistant.notConfigured")}</p>
        <Button asChild variant="outline" className="mx-auto w-fit">
          <Link href="/parametres?onglet=integrations">{t("assistant.openSettings")}</Link>
        </Button>
      </div>
    );
  }

  const streaming = assistant.status === "streaming";
  return (
    <div className="grid min-h-0 gap-4">
      <div
        className={cn("grid content-start gap-5 overflow-y-auto", compact ? "max-h-[55vh]" : "")}
        aria-live="polite"
        aria-busy={streaming}
      >
        {assistant.messages.length === 0 && !autoAsk ? (
          <div className="grid gap-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <SparklesIcon className="size-4 text-primary" aria-hidden />
              {t("hub.description")}
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void ask(t(key))}
                >
                  {t(key)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {assistant.messages.map((message) =>
          message.role === "user" ? (
            <div
              key={message.id}
              className="ml-auto max-w-[85%] rounded-2xl bg-muted px-4 py-2 text-sm"
            >
              <span className="sr-only">{t("assistant.you")} : </span>
              {message.text}
            </div>
          ) : (
            <AssistantAnswer key={message.id} message={message} />
          ),
        )}
        {assistant.error ? (
          <p role="alert" className="text-sm text-destructive">
            {t(assistant.error)}
          </p>
        ) : null}
        <div ref={end} />
      </div>

      <form onSubmit={submit} className="grid gap-2">
        <div className="relative">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={t("assistant.placeholder")}
            aria-label={t("assistant.placeholder")}
            rows={compact ? 2 : 3}
            maxLength={2000}
            autoFocus={compact}
            className="resize-none pr-14"
          />
          <Button
            type="submit"
            size="icon"
            disabled={streaming || !draft.trim()}
            aria-label={t("assistant.send")}
            className="absolute right-2 bottom-2"
          >
            {streaming ? <LoaderIcon className="animate-spin" /> : <ArrowUpIcon />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("assistant.disclaimer")}</p>
      </form>
    </div>
  );
}

function AssistantAnswer({ message }: { message: ChatMessage }) {
  return (
    <article className="grid gap-3">
      {message.steps.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("assistant.title")}>
          {[...new Set(message.steps)].map((step) => (
            <li
              key={step}
              className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground"
            >
              <CheckIcon className="size-3" aria-hidden />
              {step}
            </li>
          ))}
        </ul>
      ) : null}
      {message.text ? (
        <div className="prose-assistant text-sm leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) =>
                href?.startsWith("/") ? (
                  <Link
                    href={href}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {children}
                  </Link>
                ) : (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {children}
                  </a>
                ),
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>
      ) : message.pending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderIcon className="size-4 animate-spin" aria-hidden />
          {t("assistant.thinking")}
        </p>
      ) : null}
      {message.proposals.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} />
      ))}
    </article>
  );
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [state, setState] = useState<"open" | "done" | "dismissed">("open");
  const [pending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      const result =
        proposal.type === "message"
          ? await approveMessage({
              memberIds: proposal.members.map((m) => m.id),
              subject: proposal.subject,
              body: proposal.body,
            })
          : await approveSegment({ name: proposal.name, filters: proposal.filters });
      if (result.error) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      setState("done");
      toast.success(
        proposal.type === "message"
          ? t("assistant.proposal.sent", { count: result.count ?? 0 })
          : t("assistant.proposal.segmentCreated"),
      );
    });
  }

  const Icon = proposal.type === "message" ? MailIcon : FilterIcon;
  return (
    <section
      aria-label={t(
        proposal.type === "message" ? "assistant.proposal.message" : "assistant.proposal.segment",
      )}
      className={cn(
        "grid gap-3 rounded-xl border bg-card p-4 text-sm shadow-border",
        state !== "open" && "opacity-70",
      )}
    >
      <header className="flex items-center gap-2 font-medium">
        <Icon className="size-4 text-primary" aria-hidden />
        {t(
          proposal.type === "message" ? "assistant.proposal.message" : "assistant.proposal.segment",
        )}
      </header>
      {proposal.type === "message" ? (
        <>
          <p className="text-xs text-muted-foreground">
            {t("assistant.proposal.recipients", { count: proposal.members.length })} :{" "}
            {proposal.members.slice(0, 8).map((m, i) => (
              <span key={m.id}>
                {i ? ", " : ""}
                <Link href={`/adherents/${m.id}`} className="underline">
                  {m.name}
                </Link>
              </span>
            ))}
            {proposal.members.length > 8 ? "…" : ""}
          </p>
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="font-medium">{proposal.subject}</p>
            <p className="mt-1 whitespace-pre-line text-muted-foreground">{proposal.body}</p>
          </div>
        </>
      ) : (
        <p>
          <span className="font-medium">{proposal.name}</span> ·{" "}
          {t("assistant.proposal.members", { count: proposal.count })}
        </p>
      )}
      {state === "open" ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={approve} disabled={pending} aria-busy={pending}>
            {proposal.type === "message"
              ? t("assistant.proposal.approve")
              : t("assistant.proposal.approveSegment")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setState("dismissed")}
            disabled={pending}
          >
            {t("assistant.proposal.dismiss")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {state === "done" ? t("assistant.proposal.approved") : t("assistant.proposal.dismissed")}
        </p>
      )}
    </section>
  );
}
