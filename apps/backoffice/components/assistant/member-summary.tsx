"use client";

import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { t } from "@/lib/i18n";
import { AssistantChat } from "./assistant-chat";

/** Fiche adhérent (gérant) : l'assistant résume la fiche et propose la prochaine action. */
export function MemberSummary({ memberId, name }: { memberId: string; name: string }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <SparklesIcon className="text-primary" data-icon="inline-start" />
          {t("hub.memberSummary")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("hub.memberSummary")}</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        <AssistantChat
          memberId={memberId}
          autoAsk={t("hub.memberSummaryPrompt")}
          compact
          onConversation={setConversationId}
        />
        {conversationId ? (
          <Link
            href={`/hub?c=${conversationId}`}
            className="justify-self-end text-xs text-muted-foreground hover:text-foreground"
          >
            {t("assistant.continueInHub")}
          </Link>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
