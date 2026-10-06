"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useUrlState } from "@/hooks/use-url-state";
import { t } from "@/lib/i18n";

/** Recherche au fil de la frappe (nom, email, téléphone) : l'URL suit, la liste se grise. */
export function MembersSearch({ initial }: { initial: string }) {
  const { set, pending } = useUrlState();
  const [value, setValue] = useState(initial);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function change(next: string) {
    setValue(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => set({ q: next.trim() || null }), 250);
  }

  return (
    <form
      role="search"
      className="w-full lg:max-w-sm"
      onSubmit={(event) => {
        event.preventDefault();
        window.clearTimeout(timer.current);
        set({ q: value.trim() || null });
      }}
    >
      <InputGroup className="bg-card">
        <InputGroupAddon>{pending ? <Spinner /> : <SearchIcon aria-hidden />}</InputGroupAddon>
        <InputGroupInput
          type="search"
          name="q"
          value={value}
          onChange={(event) => change(event.target.value)}
          placeholder={t("members.searchPlaceholder")}
          aria-label={t("members.searchPlaceholder")}
        />
        {value ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={t("forms.clear")}
              onClick={() => change("")}
            >
              <XIcon aria-hidden />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </form>
  );
}
