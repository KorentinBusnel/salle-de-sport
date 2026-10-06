"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

type Selection = {
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
  setAll: (ids: string[], on: boolean) => void;
  clear: () => void;
};

const SelectionContext = createContext<Selection | null>(null);

/**
 * Sélection de lignes (Watermelon data-table-3) : remise à zéro quand la liste change
 * (`resetKey` : page, filtres, recherche).
 */
export function SelectionProvider({
  resetKey,
  children,
}: {
  resetKey: string;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    setKey(resetKey);
    setSelected(new Set());
  }
  return (
    <SelectionContext.Provider
      value={{
        selected,
        toggle: (id) =>
          setSelected((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          }),
        setAll: (ids, on) =>
          setSelected((current) => {
            const next = new Set(current);
            for (const id of ids) {
              if (on) next.add(id);
              else next.delete(id);
            }
            return next;
          }),
        clear: () => setSelected(new Set()),
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  return useContext(SelectionContext);
}

export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const selection = useSelection();
  return (
    <Checkbox
      aria-label={label}
      checked={selection?.selected.has(id) ?? false}
      onCheckedChange={() => selection?.toggle(id)}
      className="pointer-coarse:size-5"
    />
  );
}

/** Case de l'en-tête : tout cocher / décocher, état intermédiaire si une partie est cochée. */
export function AllCheckbox({ ids, label }: { ids: string[]; label: string }) {
  const selection = useSelection();
  const count = ids.filter((id) => selection?.selected.has(id)).length;
  const state = count === 0 ? false : count === ids.length ? true : "indeterminate";
  return (
    <Checkbox
      aria-label={label}
      checked={state}
      onCheckedChange={() => selection?.setAll(ids, state !== true)}
      className="pointer-coarse:size-5"
    />
  );
}
