"use client";

import { NO_COLUMNS_PARAM } from "@salle/shared";
import { Columns3Icon } from "lucide-react";
import { type ReactNode, useState, useSyncExternalStore } from "react";
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
import { useUrlState } from "@/hooks/use-url-state";
import { t } from "@/lib/i18n";

export type Density = "comfortable" | "compact";
export type TableColumn = { key: string; label: string };

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: Density }>();

function read(table: string): Density {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(`tableau:${table}`);
  } catch {
    // Stockage indisponible (navigation privée, données bloquées) : réglage par défaut.
  }
  const cached = cache.get(table);
  if (cached && cached.raw === raw) return cached.value;
  let value: Density = "comfortable";
  try {
    const parsed = raw ? (JSON.parse(raw) as { density?: unknown }) : null;
    if (parsed?.density === "compact") value = "compact";
  } catch {
    value = "comfortable";
  }
  cache.set(table, { raw, value });
  return value;
}

function write(table: string, density: Density) {
  const raw = JSON.stringify({ density });
  try {
    window.localStorage.setItem(`tableau:${table}`, raw);
  } catch {
    // Sans stockage : le réglage vaut pour la page ouverte seulement.
    cache.set(table, { raw, value: density });
  }
  for (const listener of listeners) listener();
}

/** Densité d'un tableau, mémorisée dans ce navigateur (les colonnes appartiennent à la vue). */
export function useTableDensity(table: string) {
  const density = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => read(table),
    () => "comfortable" as Density,
  );
  return { density, setDensity: (next: Density) => write(table, next) };
}

/** Cadre d'un tableau rendu côté serveur : applique la densité sans nouveau rendu serveur. */
export function DataTableFrame({ table, children }: { table: string; children: ReactNode }) {
  const { density } = useTableDensity(table);
  return (
    <div
      data-table={table}
      data-density={density}
      className="data-[density=compact]:[&_td]:py-1 data-[density=compact]:[&_th]:h-8"
    >
      {children}
    </div>
  );
}

/**
 * Menu « Colonnes » : colonnes affichées (portées par l'URL, `?cols=`, puis enregistrées avec
 * la vue) et densité des lignes (Watermelon data-table-10).
 */
export function ColumnsMenu({
  table,
  columns,
  visible,
  param = "cols",
}: {
  table: string;
  columns: TableColumn[];
  visible: string[];
  param?: string | undefined;
}) {
  const { density, setDensity } = useTableDensity(table);
  const { set } = useUrlState();
  // Cases cochées tenues localement : plusieurs clics de suite avant la réponse du serveur.
  const [shown, setShown] = useState(visible);
  const [source, setSource] = useState(visible.join(","));
  if (source !== visible.join(",")) {
    setSource(visible.join(","));
    setShown(visible);
  }
  function toggle(key: string) {
    const next = shown.includes(key)
      ? shown.filter((column) => column !== key)
      : columns.map((column) => column.key).filter((k) => k === key || shown.includes(k));
    setShown(next);
    set({ [param]: next.length ? next.join(",") : NO_COLUMNS_PARAM }, { keepPage: true });
  }
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
            checked={shown.includes(column.key)}
            onCheckedChange={() => toggle(column.key)}
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
