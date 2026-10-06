"use client";

import { MESSAGE_STATUS_TONE, type MessageStatus } from "@salle/shared";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/components/status-pill";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { t } from "@/lib/i18n";

export type MessageRow = {
  id: string;
  subject: string;
  body: string;
  status: MessageStatus;
  origin: string;
  toAddress: string | null;
  when: string;
  createdAt: string;
  member: { id: string; name: string } | null;
};

/**
 * Journal des messages : une ligne par message, ouverte dans un panneau latéral (d'après
 * tallie-dashboard) avec le texte complet, le destinataire et son contexte.
 */
export function MessagesList({ messages }: { messages: MessageRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const current = messages.find((m) => m.id === openId) ?? null;

  return (
    <>
      <ul className="divide-y overflow-hidden rounded-xl bg-card shadow-border">
        {messages.map((message) => (
          <li key={message.id}>
            <button
              type="button"
              onClick={() => setOpenId(message.id)}
              aria-haspopup="dialog"
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none pointer-coarse:min-h-12"
            >
              <span className="grid min-w-0 flex-1 basis-64">
                <span className="truncate font-medium">{message.subject}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {message.member?.name ?? t("common.none")}
                  {message.toAddress ? ` · ${message.toAddress}` : ""}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`messages.origins.${message.origin as "direct"}`)}
              </span>
              <StatusPill tone={MESSAGE_STATUS_TONE[message.status]}>
                {t(`messages.statuses.${message.status}`)}
              </StatusPill>
              <time
                dateTime={message.createdAt}
                className="w-28 text-right text-xs text-muted-foreground tabular-nums"
              >
                {message.when}
              </time>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={current !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {current ? (
            <>
              <SheetHeader>
                <SheetTitle>{current.subject}</SheetTitle>
                <SheetDescription>
                  {t(`messages.origins.${current.origin as "direct"}`)} · {current.when}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="grid content-start gap-5">
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">{t("messages.recipient")}</dt>
                  <dd className="truncate">
                    {current.member ? (
                      <Link
                        href={`/adherents/${current.member.id}`}
                        className="font-medium hover:underline"
                      >
                        {current.member.name}
                      </Link>
                    ) : (
                      t("common.none")
                    )}
                  </dd>
                  <dt className="text-muted-foreground">{t("messages.address")}</dt>
                  <dd className="truncate">{current.toAddress ?? t("common.none")}</dd>
                  <dt className="text-muted-foreground">{t("messages.status")}</dt>
                  <dd>
                    <StatusPill tone={MESSAGE_STATUS_TONE[current.status]}>
                      {t(`messages.statuses.${current.status}`)}
                    </StatusPill>
                  </dd>
                </dl>
                <div className="rounded-lg bg-muted/50 p-4 text-sm whitespace-pre-line">
                  {current.body}
                </div>
                {current.toAddress ? null : (
                  <p className="text-xs text-muted-foreground">{t("messages.noAddress")}</p>
                )}
              </SheetBody>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
