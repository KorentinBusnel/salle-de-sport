"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MemberPicker, type PickedMember } from "@/components/members/member-picker";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useUrlState } from "@/hooks/use-url-state";
import { t } from "@/lib/i18n";

const ALL = "all";

/**
 * Filtres du journal des messages, appliqués aussitôt (URL, sans rechargement) : recherche
 * (objet, adresse), adhérent, origine et statut.
 */
export function MessagesFilters({
  origins,
  statuses,
  initial,
}: {
  origins: readonly string[];
  statuses: readonly string[];
  initial: { q: string; origin: string | null; status: string | null; member: PickedMember | null };
}) {
  const { set, pending } = useUrlState();
  const [query, setQuery] = useState(initial.q);
  const [member, setMember] = useState(initial.member);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function search(next: string) {
    setQuery(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => set({ q: next.trim() || null }), 250);
  }

  return (
    <div
      role="search"
      aria-label={t("messages.filters")}
      className="flex flex-col gap-2 lg:flex-row lg:items-center"
    >
      <InputGroup className="bg-card lg:max-w-xs">
        <InputGroupAddon>{pending ? <Spinner /> : <SearchIcon aria-hidden />}</InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder={t("messages.searchPlaceholder")}
          aria-label={t("messages.searchPlaceholder")}
        />
        {query ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={t("forms.clear")}
              onClick={() => search("")}
            >
              <XIcon aria-hidden />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
      <MemberPicker
        value={member}
        onChange={(next) => {
          setMember(next);
          set({ adherent: next?.id ?? null });
        }}
        label={t("messages.member")}
        placeholder={t("messages.allMembers")}
        className="lg:w-60"
      />
      <div className="grid grid-cols-2 gap-2 lg:flex">
        <Select
          value={initial.origin ?? ALL}
          onValueChange={(value) => set({ origine: value === ALL ? null : value })}
        >
          <SelectTrigger aria-label={t("messages.origin")} className="w-full bg-card lg:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("messages.allOrigins")}</SelectItem>
            {origins.map((origin) => (
              <SelectItem key={origin} value={origin}>
                {t(`messages.origins.${origin as "direct"}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={initial.status ?? ALL}
          onValueChange={(value) => set({ statut: value === ALL ? null : value })}
        >
          <SelectTrigger aria-label={t("messages.status")} className="w-full bg-card lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("messages.allStatuses")}</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`messages.statuses.${status as "queued"}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
