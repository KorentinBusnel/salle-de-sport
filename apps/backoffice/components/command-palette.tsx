"use client";

import { ArrowRightIcon, SearchIcon, SparklesIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMemberSearch } from "@/hooks/use-member-search";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { type MessageKey, t } from "@/lib/i18n";

const ASK_EVENT = "salle:assistant-ask";

/** Ouvre l'assistant de la palette sur une demande préparée (brief, cartes du Hub…). */
export function openAssistant(prompt: string) {
  window.dispatchEvent(new CustomEvent<string>(ASK_EVENT, { detail: prompt }));
}

const SUGGESTIONS = [
  "assistant.suggestions.week",
  "assistant.suggestions.churn",
  "assistant.suggestions.fill",
  "assistant.suggestions.noShows",
] as const satisfies readonly MessageKey[];

/**
 * Champ unique de la barre du haut (⌘K / Ctrl+K ou « / ») : recherche d'adhérent au fil de la
 * frappe (accueil et gérant) et, pour le gérant, question à l'assistant dans la même palette.
 */
export function CommandPalette({ members, assistant }: { members: boolean; assistant: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const term = query.trim();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (!typing && event.key === "/") {
        event.preventDefault();
        setOpen(true);
      }
    }
    function onAsk(event: Event) {
      if (!assistant) return;
      setQuestion((event as CustomEvent<string>).detail);
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(ASK_EVENT, onAsk);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(ASK_EVENT, onAsk);
    };
  }, [assistant]);

  const { hits: results } = useMemberSearch(query, { enabled: members && open });

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setQuestion(null);
      setConversationId(null);
    }
  }
  function go(href: string) {
    reset(false);
    router.push(href);
  }

  const placeholder = t(assistant ? "topbar.searchOrAsk" : "topbar.searchPlaceholder");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Meta+K Control+K /"
        className="flex h-9 w-full max-w-md min-w-0 items-center gap-2 rounded-lg border border-input bg-card px-3 text-left text-sm text-muted-foreground hover:border-ring/60 pointer-coarse:h-10"
      >
        {assistant ? (
          <SparklesIcon className="size-4 shrink-0 text-primary" aria-hidden />
        ) : (
          <SearchIcon className="size-4 shrink-0" aria-hidden />
        )}
        <span className="flex-1 truncate">{placeholder}</span>
        <Kbd className="hidden md:inline-flex">⌘K</Kbd>
      </button>

      <Dialog open={open} onOpenChange={reset}>
        {question ? (
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <SparklesIcon className="size-4 text-primary" aria-hidden />
                {t("assistant.title")}
              </DialogTitle>
              <DialogDescription>{t("assistant.disclaimer")}</DialogDescription>
            </DialogHeader>
            <AssistantChat
              key={question}
              autoAsk={question}
              compact
              onConversation={setConversationId}
            />
            {conversationId ? (
              <Link
                href={`/hub?c=${conversationId}`}
                onClick={() => reset(false)}
                className="justify-self-start text-sm font-medium text-primary hover:underline"
              >
                {t("assistant.continueInHub")}
              </Link>
            ) : null}
          </DialogContent>
        ) : (
          <DialogContent
            className="top-1/4 translate-y-0 overflow-hidden p-0 sm:max-w-xl"
            showCloseButton={false}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>{placeholder}</DialogTitle>
              <DialogDescription>{t("topbar.paletteHelp")}</DialogDescription>
            </DialogHeader>
            <Command shouldFilter={false} loop>
              <CommandInput value={query} onValueChange={setQuery} placeholder={placeholder} />
              <CommandList>
                <CommandEmpty>
                  {term.length < 2 ? t("topbar.minChars") : t("topbar.noResults")}
                </CommandEmpty>
                {assistant && term ? (
                  <CommandGroup heading={t("topbar.assistantGroup")}>
                    <CommandItem value={`ask:${term}`} onSelect={() => setQuestion(term)}>
                      <SparklesIcon className="text-primary" />
                      <span className="truncate">{t("topbar.askAbout", { question: term })}</span>
                    </CommandItem>
                  </CommandGroup>
                ) : null}
                {assistant && !term ? (
                  <CommandGroup heading={t("topbar.assistantGroup")}>
                    {SUGGESTIONS.map((key) => (
                      <CommandItem key={key} value={key} onSelect={() => setQuestion(t(key))}>
                        <SparklesIcon className="text-primary" />
                        {t(key)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {results.length ? (
                  <CommandGroup heading={t("topbar.membersGroup")}>
                    {results.map((member) => (
                      <CommandItem
                        key={member.id}
                        value={`member:${member.id}`}
                        onSelect={() => go(`/adherents/${member.id}`)}
                      >
                        <UserIcon />
                        <span className="truncate">
                          {member.first_name} {member.last_name}
                        </span>
                        {member.email ? (
                          <span className="ml-auto truncate text-xs text-muted-foreground">
                            {member.email}
                          </span>
                        ) : null}
                      </CommandItem>
                    ))}
                    <CommandItem
                      value={`all:${term}`}
                      onSelect={() => go(`/adherents?q=${encodeURIComponent(term)}`)}
                    >
                      <ArrowRightIcon />
                      {t("topbar.allResults", { query: term })}
                    </CommandItem>
                  </CommandGroup>
                ) : null}
              </CommandList>
            </Command>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
