"use client";

import {
  ArrowUpIcon,
  CheckIcon,
  FilterIcon,
  LoaderIcon,
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
 * Conversation avec l'assistant : fil des questions et réponses (Markdown, liens internes),
 * étapes en cours, cartes de propositions modifiables avant validation, saisie (Entrée pour
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
      {message.stopped ? (
        <p className="text-xs text-muted-foreground">{t("assistant.stopped")}</p>
      ) : null}
      {message.proposals.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} />
      ))}
    </article>
  );
}

const SUBJECT_MAX = 200;
const BODY_MAX = 4000;
const SEGMENT_NAME_MAX = 80;

/**
 * Proposition de l'assistant, modifiable avant validation : destinataires retirables, objet et
 * texte du message, nom du segment. Rien ne part sans « Valider ».
 */
function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [state, setState] = useState<"open" | "done" | "dismissed">("open");
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
      toast.success(
        proposal.type === "message"
          ? t("assistant.proposal.sent", { count: result.count ?? 0 })
          : t("assistant.proposal.segmentCreated"),
      );
    });
  }

  const open = state === "open";
  const Icon = proposal.type === "message" ? MailIcon : FilterIcon;
  const label = t(
    proposal.type === "message" ? "assistant.proposal.message" : "assistant.proposal.segment",
  );
  return (
    <section
      aria-label={label}
      className={cn(
        "grid gap-3 rounded-xl border bg-card p-4 text-sm shadow-border",
        !open && "opacity-70",
      )}
    >
      <header className="flex items-center gap-2 font-medium">
        <Icon className="size-4 text-primary" aria-hidden />
        {label}
        {open ? (
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {t("assistant.proposal.editable")}
          </span>
        ) : null}
      </header>
      {proposal.type === "message" ? (
        <>
          <div className="grid gap-1.5">
            <p className="text-xs text-muted-foreground">
              {t("assistant.proposal.recipients", { count: members.length })}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex h-7 items-center gap-1 rounded-full bg-muted pr-1 pl-2.5 text-xs"
                >
                  <Link href={`/adherents/${m.id}`} className="hover:underline">
                    {m.name}
                  </Link>
                  {open ? (
                    <button
                      type="button"
                      onClick={() => setMembers((list) => list.filter((x) => x.id !== m.id))}
                      aria-label={t("assistant.proposal.removeRecipient", { name: m.name })}
                      className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground pointer-coarse:size-7"
                    >
                      <XIcon className="size-3" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-subject`}>{t("assistant.proposal.subject")}</Label>
            <Input
              id={`${id}-subject`}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={SUBJECT_MAX}
              disabled={!open}
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
              disabled={!open}
            />
          </div>
        </>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>{t("assistant.proposal.segmentName")}</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={SEGMENT_NAME_MAX}
            disabled={!open}
          />
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("assistant.proposal.members", { count: proposal.count })}
          </p>
        </div>
      )}
      {open ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={approve} disabled={pending || !valid} aria-busy={pending}>
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
