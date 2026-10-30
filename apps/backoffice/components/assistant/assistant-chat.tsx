"use client";

import {
  ArrowUpIcon,
  CheckIcon,
  FilterIcon,
  MailIcon,
  SparklesIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { approveMessage, approveSegment } from "@/app/(app)/hub/actions";
import { TextareaWithCount } from "@/components/forms/textarea-with-count";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
 * Conversation avec l'assistant, au rendu de la landing : question dans une bulle orange,
 * réponse précédée de la pastille étincelle (Markdown, liens internes, tableaux en lignes),
 * étapes en cours, propositions repliées (« Modifier », « Valider l'envoi »), saisie (Entrée pour
 * envoyer, « Arrêter » pendant la réponse). `fill` : occupe la hauteur du parent, fil défilant et
 * saisie collée en bas (Hub).
 */
export function AssistantChat({
  conversationId,
  initialMessages,
  memberId,
  autoAsk,
  compact = false,
  fill = false,
  onConversation,
}: {
  conversationId?: string | undefined;
  initialMessages?: ChatMessage[] | undefined;
  memberId?: string | undefined;
  /** Question posée dès l'affichage (résumé d'une fiche adhérent). */
  autoAsk?: string | undefined;
  compact?: boolean | undefined;
  fill?: boolean | undefined;
  /** Conversation créée ou reprise, avec sa première question (titre provisoire). */
  onConversation?: ((id: string, firstQuestion: string) => void) | undefined;
}) {
  const assistant = useAssistant({
    conversationId,
    initialMessages: initialMessages ?? [],
    memberId,
  });
  const [draft, setDraft] = useState("");
  const asked = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const { ask, stop, conversationId: currentId } = assistant;
  const firstQuestion = assistant.messages.find((m) => m.role === "user")?.text ?? "";

  useEffect(() => {
    if (autoAsk && !asked.current) {
      asked.current = true;
      void ask(autoAsk);
    }
  }, [autoAsk, ask]);
  useEffect(() => {
    if (currentId) onConversation?.(currentId, firstQuestion);
  }, [currentId, firstQuestion, onConversation]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
    <div className={cn("min-h-0", fill ? "flex flex-1 flex-col" : "grid gap-4")}>
      <div
        className={cn(
          "grid content-start gap-5 overflow-y-auto",
          compact && "max-h-[55vh]",
          fill && "min-h-0 flex-1 overscroll-contain p-4",
        )}
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
              className="ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
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

      <form
        onSubmit={submit}
        className={cn("grid gap-2", fill && "shrink-0 border-t bg-card p-3 sm:rounded-b-xl")}
      >
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
            rows={compact || fill ? 2 : 3}
            maxLength={2000}
            autoFocus={compact}
            className="resize-none pr-14"
          />
          {streaming ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={stop}
              aria-label={t("assistant.stop")}
              title={t("assistant.stop")}
              className="absolute right-2 bottom-2"
            >
              <SquareIcon className="fill-current" aria-hidden />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!draft.trim()}
              aria-label={t("assistant.send")}
              className="absolute right-2 bottom-2"
            >
              <ArrowUpIcon aria-hidden />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("assistant.disclaimer")}</p>
      </form>
    </div>
  );
}

function AssistantAnswer({ message }: { message: ChatMessage }) {
  return (
    <article className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
        <SparklesIcon className="size-4" aria-hidden />
      </span>
      <div className="grid min-w-0 flex-1 content-start gap-3">
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
          <p className="flex h-8 items-center gap-1" role="status">
            <span className="sr-only">{t("assistant.thinking")}</span>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                aria-hidden
                className="size-1.5 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </p>
        ) : null}
        {message.stopped ? (
          <p className="text-xs text-muted-foreground">{t("assistant.stopped")}</p>
        ) : null}
        {message.proposals.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>
    </article>
  );
}

const SUBJECT_MAX = 200;
const BODY_MAX = 4000;
const SEGMENT_NAME_MAX = 80;

/**
 * Proposition de l'assistant, repliée comme sur la landing : « Message proposé à N adhérents »,
 * objet et début du texte, puis « Modifier » (destinataires retirables, objet, texte, nom du
 * segment) et « Valider l'envoi ». Rien ne part sans validation.
 */
function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [state, setState] = useState<"open" | "done" | "dismissed">("open");
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [members, setMembers] = useState(proposal.type === "message" ? proposal.members : []);
  const [subject, setSubject] = useState(proposal.type === "message" ? proposal.subject : "");
  const [body, setBody] = useState(proposal.type === "message" ? proposal.body : "");
  const [name, setName] = useState(proposal.type === "segment" ? proposal.name : "");
  const id = proposal.id;

  const valid =
    proposal.type === "message"
      ? members.length > 0 && subject.trim().length > 0 && body.trim().length > 0
      : name.trim().length > 0;

  function approve() {
    startTransition(async () => {
      const result =
        proposal.type === "message"
          ? await approveMessage({ memberIds: members.map((m) => m.id), subject, body })
          : await approveSegment({ name, filters: proposal.filters });
      if (result.error) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      setState("done");
      setEditing(false);
      toast.success(
        proposal.type === "message"
          ? t("assistant.proposal.sent", { count: result.count ?? 0 })
          : t("assistant.proposal.segmentCreated"),
      );
    });
  }

  const open = state === "open";
  const fields = open && editing;
  const Icon = proposal.type === "message" ? MailIcon : FilterIcon;
  const label =
    proposal.type === "message"
      ? t("assistant.proposal.messageTo", { count: members.length })
      : t("assistant.proposal.segment");
  return (
    <section
      aria-label={label}
      className={cn(
        "grid gap-3 rounded-xl bg-card p-4 text-sm shadow-border",
        !open && "opacity-70",
      )}
    >
      <header className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden />
        {label}
      </header>
      {proposal.type === "message" ? (
        fields ? (
          <>
            <ul className="flex flex-wrap gap-1.5" aria-label={t("assistant.proposal.to")}>
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex h-7 items-center gap-1 rounded-full bg-muted pr-1 pl-2.5 text-xs"
                >
                  <Link href={`/adherents/${m.id}`} className="hover:underline">
                    {m.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setMembers((list) => list.filter((x) => x.id !== m.id))}
                    aria-label={t("assistant.proposal.removeRecipient", { name: m.name })}
                    className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground pointer-coarse:size-7"
                  >
                    <XIcon className="size-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-subject`}>{t("assistant.proposal.subject")}</Label>
              <Input
                id={`${id}-subject`}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={SUBJECT_MAX}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-body`}>{t("assistant.proposal.body")}</Label>
              <TextareaWithCount
                id={`${id}-body`}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={BODY_MAX}
                rows={5}
              />
            </div>
          </>
        ) : (
          <div className="grid gap-1">
            <p className="font-medium">{subject}</p>
            <p className="line-clamp-2 text-muted-foreground">{body}</p>
            <p className="truncate text-xs text-muted-foreground">
              {members.map((m) => m.name).join(", ")}
            </p>
          </div>
        )
      ) : fields ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>{t("assistant.proposal.segmentName")}</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={SEGMENT_NAME_MAX}
          />
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("assistant.proposal.members", { count: proposal.count })}
          </p>
        </div>
      ) : (
        <p>
          <span className="font-medium">{name}</span>{" "}
          <span className="text-muted-foreground tabular-nums">
            · {t("assistant.proposal.members", { count: proposal.count })}
          </span>
        </p>
      )}
      {open ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setState("dismissed")}
            disabled={pending}
            className="mr-auto text-muted-foreground"
          >
            {t("assistant.proposal.dismiss")}
          </Button>
          {editing ? null : (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              {t("assistant.proposal.edit")}
            </Button>
          )}
          <Button size="sm" onClick={approve} disabled={pending || !valid} aria-busy={pending}>
            {proposal.type === "message"
              ? t("assistant.proposal.approve")
              : t("assistant.proposal.approveSegment")}
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
