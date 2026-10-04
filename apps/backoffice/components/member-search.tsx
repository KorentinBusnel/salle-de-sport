"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { t } from "@/lib/i18n";

/**
 * Recherche d'adhérent de la barre du haut : simple formulaire GET vers /adherents
 * (fonctionne sans JavaScript). « / » ou ⌘K / Ctrl+K place le curseur dans le champ.
 */
export function MemberSearch() {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      const shortcut =
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") ||
        (!typing && event.key === "/");
      if (!shortcut) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form action="/adherents" role="search" className="w-full max-w-sm">
      <InputGroup className="bg-card">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          ref={input}
          type="search"
          name="q"
          placeholder={t("topbar.searchPlaceholder")}
          aria-label={t("topbar.searchLabel")}
          autoComplete="off"
        />
        <InputGroupAddon align="inline-end" className="hidden md:flex">
          <Kbd>/</Kbd>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
