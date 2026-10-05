"use client";

import type { NumberSettingMeta } from "@salle/shared";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { saveSetting } from "@/app/(app)/parametres/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/action-result";
import { type MessageKey, t } from "@/lib/i18n";
import { toastUndo } from "@/lib/toast-undo";
import { cn } from "@/lib/utils";

const outcome = (result: ActionResult) => (result.ok ? {} : { error: result.error });

/**
 * Valeur enregistrée sur place (Watermelon switch-19) : affichage optimiste, toast
 * « Annuler » (10 s) qui rétablit l'ancienne valeur, retour arrière si la base refuse.
 */
export function useAutosave<T>(
  initial: T,
  save: (value: T) => Promise<ActionResult>,
  /** Identifiant du toast : les modifications successives d'un même réglage le remplacent. */
  toastId?: string,
) {
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  const current = useRef(initial);

  function commit(next: T, message: string) {
    const previous = current.current;
    if (Object.is(previous, next) || JSON.stringify(previous) === JSON.stringify(next)) return;
    current.current = next;
    setValue(next);
    setPending(true);
    toastUndo({
      message,
      mode: "inverse",
      id: toastId,
      run: async () => {
        const result = await save(next);
        if (!result.ok) {
          current.current = previous;
          setValue(previous);
        }
        return outcome(result);
      },
      undo: async () => {
        current.current = previous;
        setValue(previous);
        const result = await save(previous);
        if (!result.ok) {
          current.current = next;
          setValue(next);
        }
        return outcome(result);
      },
      onSettled: () => setPending(false),
    });
  }

  return { value, commit, pending };
}

/** Ligne de réglage : libellé et aide à gauche, commande à droite (en dessous au téléphone). */
export function SettingRow({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="grid min-w-0 gap-1">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Groupe de lignes séparées par un filet. */
export function SettingRows({ children }: { children: ReactNode }) {
  return <div className="divide-y">{children}</div>;
}

const metaKey = (key: string, part: "label" | "hint") =>
  `settings.meta.${key}.${part}` as MessageKey;

/** Réglage chiffré : champ avec − / +, bornes tirées du schéma, enregistré à la sortie du champ. */
export function SettingNumberRow({
  meta,
  value: initial,
}: {
  meta: NumberSettingMeta;
  value: number | null;
}) {
  const id = useId();
  const label = t(metaKey(meta.key, "label"));
  const { value, commit, pending } = useAutosave<number | null>(
    initial,
    (next) => saveSetting({ key: meta.key, value: next }),
    `setting-${meta.key}`,
  );
  const [text, setText] = useState(initial === null ? "" : String(initial));
  const [error, setError] = useState<string | null>(null);
  const unit = t(`settings.unit.${meta.unit}`);
  const range = t(meta.nullable ? "settings.rangeNullable" : "settings.range", {
    min: meta.min,
    max: meta.max,
  });

  // Une valeur rétablie (« Annuler », refus de la base) remplace la saisie.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(value === null ? "" : String(value));
  }

  // Les − / + attendent une courte pause avant d'enregistrer (un seul toast par rafale).
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  function parse(raw: string): number | null | undefined {
    const trimmed = raw.trim().replace(",", ".");
    if (trimmed === "") return meta.nullable ? null : undefined;
    const number = Number(trimmed);
    if (!Number.isFinite(number)) return undefined;
    if (meta.integer && !Number.isInteger(number)) return undefined;
    if (number < meta.min || number > meta.max) return undefined;
    return number;
  }

  function save(raw: string, delay = 0) {
    const next = parse(raw);
    if (next === undefined) {
      setError(`${t("settings.errors.outOfRange")} ${range}.`);
      return;
    }
    setError(null);
    if (timer.current) window.clearTimeout(timer.current);
    const run = () => commit(next, `${label} : ${t("settings.saved")}`);
    if (delay) timer.current = window.setTimeout(run, delay);
    else run();
  }

  function step(direction: 1 | -1) {
    const base = parse(text) ?? value ?? meta.defaultValue ?? meta.min;
    const next = Math.min(meta.max, Math.max(meta.min, base + direction * meta.step));
    setText(String(next));
    save(String(next), 700);
  }

  return (
    <SettingRow
      id={id}
      label={label}
      hint={
        <>
          {t(metaKey(meta.key, "hint"))}{" "}
          <span className="tabular-nums">
            {range}
            {meta.defaultValue !== null
              ? ` · ${t("settings.defaultValue", { value: `${meta.defaultValue} ${unit}` })}`
              : ""}
            .
          </span>
        </>
      }
      error={error}
    >
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t("settings.less", { label })}
          disabled={value !== null && value <= meta.min}
          onClick={() => step(-1)}
        >
          <MinusIcon aria-hidden />
        </Button>
        <div className="relative">
          <Input
            id={id}
            inputMode={meta.integer ? "numeric" : "decimal"}
            value={text}
            placeholder={meta.nullable ? t("settings.noLimit") : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
            aria-busy={pending || undefined}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => save(text)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save(text);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                step(1);
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                step(-1);
              }
            }}
            className={cn("w-28 pr-12 text-right tabular-nums", meta.nullable && "w-32")}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground"
          >
            {unit}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t("settings.more", { label })}
          disabled={value !== null && value >= meta.max}
          onClick={() => step(1)}
        >
          <PlusIcon aria-hidden />
        </Button>
      </div>
    </SettingRow>
  );
}

/** Réglage oui / non, enregistré au basculement. */
export function SettingSwitchRow({
  settingKey,
  value: initial,
}: {
  settingKey: string;
  value: boolean;
}) {
  const id = useId();
  const label = t(metaKey(settingKey, "label"));
  const { value, commit } = useAutosave(
    initial,
    (next) => saveSetting({ key: settingKey, value: next }),
    `setting-${settingKey}`,
  );
  return (
    <SettingRow id={id} label={label} hint={t(metaKey(settingKey, "hint"))}>
      <Switch
        id={id}
        checked={value}
        aria-describedby={`${id}-hint`}
        onCheckedChange={(checked) => commit(checked, `${label} : ${t("settings.saved")}`)}
        className="pointer-coarse:scale-125"
      />
    </SettingRow>
  );
}

/** Texte enregistré à la sortie du champ (identité de la salle), erreur affichée sous le libellé. */
export function SettingTextRow({
  label,
  hint,
  value: initial,
  type = "text",
  autoComplete,
  save,
  maxLength,
}: {
  label: string;
  hint?: ReactNode;
  value: string;
  type?: "text" | "email" | "tel" | undefined;
  autoComplete?: string | undefined;
  save: (value: string) => Promise<ActionResult>;
  maxLength: number;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState(initial);
  const saved = useRef(initial);

  function commit(next: string) {
    const previous = saved.current;
    if (next === previous) return;
    void save(next).then((result) => {
      // Refus de validation : la saisie reste, l'erreur s'affiche sous le libellé.
      if (!result.ok) return setError(t(result.error));
      setError(null);
      saved.current = next;
      toastUndo({
        message: `${label} : ${t("settings.saved")}`,
        mode: "inverse",
        id: `setting-${id}`,
        run: async () => ({}),
        undo: async () => {
          const undone = await save(previous);
          if (undone.ok) {
            saved.current = previous;
            setText(previous);
          }
          return outcome(undone);
        },
      });
    });
  }

  return (
    <SettingRow id={id} label={label} hint={hint} error={error}>
      <Input
        id={id}
        type={type}
        value={text}
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
          undefined
        }
        onChange={(event) => setText(event.target.value)}
        onBlur={() => commit(text.trim())}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setText(saved.current);
            setError(null);
          }
        }}
        className="w-full sm:w-80"
      />
    </SettingRow>
  );
}
