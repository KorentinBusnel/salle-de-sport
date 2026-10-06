"use client";

import { MEMBER_STATUS_TONE, TONE_CLASSES } from "@salle/shared";
import { CheckIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { useSessionLive } from "@/components/session/session-live";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { useMemberSearch, type MemberHit } from "@/hooks/use-member-search";
import { initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Recherche d'adhérent au fil de la frappe (nom complet, sans accents, téléphone) puis
 * inscription en un clic : la ligne apparaît aussitôt dans la liste (SessionLiveProvider).
 */
export function MemberCombobox({ excludeIds, full }: { excludeIds: string[]; full: boolean }) {
  const [query, setQuery] = useState("");
  const { hits, loading, short } = useMemberSearch(query);
  const live = useSessionLive();
  const excluded = new Set([...excludeIds, ...(live?.pending.map((p) => p.id) ?? [])]);

  function book(member: MemberHit) {
    live?.book({ id: member.id, name: `${member.first_name} ${member.last_name}` });
    setQuery("");
  }

  return (
    <div className="grid gap-2">
      <Command shouldFilter={false} className="rounded-xl shadow-border">
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("session.searchPlaceholder")}
          aria-label={t("session.searchPlaceholder")}
        />
        <CommandList>
          {short ? (
            <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <SearchIcon className="size-4" aria-hidden />
              {t("session.searchHint")}
            </p>
          ) : loading && hits.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Spinner /> {t("ui.loading")}
            </p>
          ) : (
            <>
              <CommandEmpty>{t("session.noResult")}</CommandEmpty>
              <CommandGroup>
                {hits.map((member) => {
                  const name = `${member.first_name} ${member.last_name}`;
                  const already = excluded.has(member.id);
                  const inactive = member.status !== "active";
                  return (
                    <CommandItem
                      key={member.id}
                      value={member.id}
                      disabled={already || inactive}
                      onSelect={() => book(member)}
                      className="gap-3 py-2"
                    >
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                      </Avatar>
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate font-medium">{name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {member.email ?? member.phone ?? ""}
                        </span>
                      </span>
                      {already ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckIcon className="size-3.5" /> {t("session.alreadyBooked")}
                        </span>
                      ) : inactive ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            TONE_CLASSES[MEMBER_STATUS_TONE[member.status]].pill,
                          )}
                        >
                          {t(`memberStatus.${member.status}`)}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-primary">
                          {full ? t("session.addToWaitlist") : t("session.book")}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
      {full ? <p className="text-xs text-muted-foreground">{t("session.fullHint")}</p> : null}
    </div>
  );
}
