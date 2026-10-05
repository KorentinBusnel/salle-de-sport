"use client";

import { ArrowUpIcon, SparklesIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { openAssistant } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { type MessageKey, t } from "@/lib/i18n";

const SUGGESTIONS = [
  "assistant.suggestions.week",
  "assistant.suggestions.churn",
  "assistant.suggestions.fill",
] as const satisfies readonly MessageKey[];

/** Question libre à l'assistant depuis le Hub (ouvre la conversation de la palette). */
export function AskBar() {
  const [value, setValue] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const question = value.trim();
    if (!question) return;
    setValue("");
    openAssistant(question);
  }
  return (
    <form onSubmit={submit} className="grid gap-2.5 rounded-2xl bg-accent p-3">
      <label className="flex min-h-12 items-center gap-2.5 rounded-xl bg-card pr-1.5 pl-3.5 shadow-border focus-within:ring-2 focus-within:ring-ring/40">
        <SparklesIcon className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="sr-only">{t("hub.askLabel")}</span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("hub.askPlaceholder")}
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
            onClick={() => openAssistant(t(key))}
          >
            {t(key)}
          </Button>
        ))}
      </div>
    </form>
  );
}
