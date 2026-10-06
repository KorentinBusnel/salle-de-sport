"use client";

import { Columns3Icon } from "lucide-react";
import { type ReactNode, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/lib/i18n";

export type Density = "comfortable" | "compact";
type Prefs = { hidden: string[]; density: Density };
export type TableColumn = { key: string; label: string };

const DEFAULTS: Prefs = { hidden: [], density: "comfortable" };
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: Prefs }>();

function read(table: string): Prefs {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(`tableau:${table}`);
  } catch {
    // Stockage indisponible (navigation privée, données bloquées) : réglages par défaut.
  }
  const cached = cache.get(table);
  if (cached && cached.raw === raw) return cached.value;
  let value = DEFAULTS;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<Prefs>) : null;
    if (parsed)
      value = {
        hidden: Array.isArray(parsed.hidden)
          ? parsed.hidden.filter((k) => typeof k === "string")
          : [],
        density: parsed.density === "compact" ? "compact" : "comfortable",
      };
  } catch {
    value = DEFAULTS;
  }
  cache.set(table, { raw, value });
  return value;
}

function write(table: string, prefs: Prefs) {
  try {
    window.localStorage.setItem(`tableau:${table}`, JSON.stringify(prefs));
  } catch {
    // Sans stockage : le réglage vaut pour la page ouverte seulement.
    cache.set(table, { raw: JSON.stringify(prefs), value: prefs });
  }
  for (const listener of listeners) listener();
}

/** Colonnes masquées et densité d'un tableau, mémorisées dans ce navigateur. */
export function useTablePrefs(table: string) {
  const prefs = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => read(table),
    () => DEFAULTS,
  );
  return {
    ...prefs,
    toggleColumn: (key: string) =>
      write(table, {
        ...prefs,
        hidden: prefs.hidden.includes(key)
          ? prefs.hidden.filter((k) => k !== key)
          : [...prefs.hidden, key],
      }),
    setDensity: (density: Density) => write(table, { ...prefs, density }),
  };
}

/**
 * Cadre d'un tableau rendu côté serveur : masque les colonnes choisies (cellules `data-col`)
 * et applique la densité, sans nouveau rendu serveur.
 */
export function DataTableFrame({ table, children }: { table: string; children: ReactNode }) {
  const { hidden, density } = useTablePrefs(table);
  return (
    <div
      data-table={table}
      data-density={density}
      className="data-[density=compact]:[&_td]:py-1 data-[density=compact]:[&_th]:h-8"
    >
      {hidden.length ? (
        <style>
          {hidden
            .map((key) => `[data-table="${table}"] [data-col="${key}"]{display:none}`)
            .join("")}
        </style>
      ) : null}
      {children}
    </div>
  );
}

/** Menu « Colonnes » : colonnes affichées et densité des lignes (Watermelon data-table-10). */
export function ColumnsMenu({ table, columns }: { table: string; columns: TableColumn[] }) {
  const { hidden, density, toggleColumn, setDensity } = useTablePrefs(table);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3Icon data-icon="inline-start" aria-hidden />
          {t("table.columns")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>{t("table.columns")}</DropdownMenuLabel>
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={!hidden.includes(column.key)}
            onCheckedChange={() => toggleColumn(column.key)}
            onSelect={(event) => event.preventDefault()}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("table.density")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={density}
          onValueChange={(value) => setDensity(value === "compact" ? "compact" : "comfortable")}
        >
          <DropdownMenuRadioItem value="comfortable">
            {t("table.comfortable")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="compact">{t("table.compact")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
