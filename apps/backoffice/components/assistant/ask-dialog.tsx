"use client";

import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { t } from "@/lib/i18n";
import { AssistantChat } from "./assistant-chat";

/** Barre « Demander… » (gérant) : bouton de la barre du haut et raccourci ⌘K / Ctrl+K. */
export function AskDialog() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [session, setSession] = useState(0);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="ml-auto gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-label={t("assistant.askShortcut")}
        aria-keyshortcuts="Meta+K Control+K"
      >
        <SparklesIcon className="text-primary" />
        <span className="hidden sm:inline">{t("assistant.ask")}</span>
        <Kbd className="hidden md:inline-flex">⌘K</Kbd>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Une nouvelle ouverture repart d'une conversation vierge.
          if (!next) {
            setConversationId(null);
            setSession((s) => s + 1);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-primary" aria-hidden />
              {t("assistant.title")}
            </DialogTitle>
            <DialogDescription>{t("hub.description")}</DialogDescription>
          </DialogHeader>
          <AssistantChat key={session} compact onConversation={setConversationId} />
          {conversationId ? (
            <Button asChild variant="link" className="justify-self-start px-0">
              <Link href={`/hub?c=${conversationId}`} onClick={() => setOpen(false)}>
                {t("assistant.continueInHub")}
              </Link>
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
