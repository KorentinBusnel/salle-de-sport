"use client";

import { ArrowUpIcon, SparklesIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { openAssistant } from "@/components/command-palette";
import { askInHub } from "@/components/hub/hub-conversations";
import { Button } from "@/components/ui/button";
import { type MessageKey, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "assistant.suggestions.absent",
  "assistant.suggestions.week",
  "assistant.suggestions.fill",
] as const satisfies readonly MessageKey[];

/**
 * Question libre à l'assistant, avec trois suggestions. `target` : « hub » ouvre une nouvelle
 * conversation dans le volet du bas du Hub, « palette » ouvre l'assistant de la barre du haut
 * (accueil). `className` remplace le fond et la marge (le bloc de l'accueil a déjà les siens).
 */
export function AskBar({
  target = "hub",
  placeholder,
  className,
}: {
  target?: "hub" | "palette";
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const ask = target === "hub" ? askInHub : openAssistant;
  function submit(event: FormEvent) {
    event.preventDefault();
    const question = value.trim();
    if (!question) return;
    setValue("");
    ask(question);
  }
  return (
    <form onSubmit={submit} className={cn("grid gap-2.5 rounded-2xl bg-accent p-3", className)}>
      <label className="flex min-h-12 items-center gap-2.5 rounded-xl bg-card pr-1.5 pl-3.5 shadow-border focus-within:ring-2 focus-within:ring-ring/40">
        <SparklesIcon className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="sr-only">{t("hub.askLabel")}</span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder ?? t("hub.askPlaceholder")}
          maxLength={2000}
          className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="icon" aria-label={t("hub.ask")} disabled={!value.trim()}>
          <ArrowUpIcon />
        </Button>
      </label>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full bg-card"
            onClick={() => ask(t(key))}
          >
            {t(key)}
          </Button>
        ))}
      </div>
    </form>
  );
}
