"use client";

import { ChevronsUpDownIcon, UserIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useMemberSearch } from "@/hooks/use-member-search";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type PickedMember = { id: string; name: string };

/**
 * Choix d'un adhérent dans un menu (recherche au fil de la frappe, sans accents) : aperçu d'un
 * modèle, filtre des messages. « Effacer » revient à la valeur par défaut (`placeholder`).
 */
export function MemberPicker({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: PickedMember | null;
  onChange: (member: PickedMember | null) => void;
  placeholder: string;
  label: string;
  className?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { hits, loading, short } = useMemberSearch(query, { enabled: open });

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={label}
            className="min-w-0 flex-1 justify-start font-normal"
          >
            <UserIcon data-icon="inline-start" aria-hidden />
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value?.name ?? placeholder}
            </span>
            <ChevronsUpDownIcon className="ml-auto opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={t("members.searchPlaceholder")}
              aria-label={t("members.searchPlaceholder")}
            />
            <CommandList>
              {loading && hits.length === 0 ? (
                <div role="status" className="flex items-center gap-2 px-3 py-4 text-sm">
                  <Spinner />
                  {t("topbar.searching")}
                </div>
              ) : (
                <CommandEmpty>{short ? t("topbar.minChars") : t("topbar.noResults")}</CommandEmpty>
              )}
              {hits.length ? (
                <CommandGroup>
                  {hits.map((member) => (
                    <CommandItem
                      key={member.id}
                      value={member.id}
                      onSelect={() => {
                        onChange({
                          id: member.id,
                          name: `${member.first_name} ${member.last_name}`,
                        });
                        setOpen(false);
                        setQuery("");
                      }}
                    >
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
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("forms.clear")}
          onClick={() => onChange(null)}
        >
          <XIcon aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
