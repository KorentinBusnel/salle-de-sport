"use client";

import { CaretDownIcon, CheckCircleIcon } from "@phosphor-icons/react/ssr";
import {
  DEMO_REQUEST_FIELDS,
  demoRequestSchema,
  MEMBERS_BANDS,
  type DemoRequestField,
} from "@salle/shared";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { requestDemo, type DemoFormState } from "@/app/actions";
import { buttonClasses } from "@/components/button";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

const INITIAL: DemoFormState = { status: "idle" };

/** Formulaire « Demander une démo » ; « Envoyer une autre demande » le remonte à neuf. */
export function DemoForm() {
  const [round, setRound] = useState(0);
  return <DemoFormRound key={round} onAgain={() => setRound((value) => value + 1)} />;
}

function DemoFormRound({ onAgain }: { onAgain: () => void }) {
  const [state, formAction, pending] = useActionState(requestDemo, INITIAL);
  // Erreurs relevées dans le navigateur avant l'envoi ; la base et le serveur revalident.
  const [clientErrors, setClientErrors] = useState<Set<DemoRequestField>>(new Set());
  const openedAt = useRef(0);
  const elapsed = useRef<HTMLInputElement>(null);
  const successTitle = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    openedAt.current = performance.now();
  }, []);
  useEffect(() => {
    if (state.status === "sent") successTitle.current?.focus();
  }, [state.status]);

  if (state.status === "sent") {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl bg-card p-6 shadow-border sm:p-8">
        <CheckCircleIcon aria-hidden="true" weight="fill" className="size-10 text-success" />
        <h3 ref={successTitle} tabIndex={-1} className="text-2xl font-semibold tracking-tight">
          {t("form.successTitle")}
        </h3>
        <p className="text-base text-muted-foreground" role="status">
          {t("form.successBody", { email: state.email })}
        </p>
        <button type="button" onClick={onAgain} className={buttonClasses("secondary")}>
          {t("form.again")}
        </button>
      </div>
    );
  }

  const values = state.status === "idle" ? null : state.values;
  const serverErrors = state.status === "invalid" ? state.fields : [];
  const invalid = new Set([...clientErrors, ...serverErrors]);
  const formError =
    state.status === "failed"
      ? t(state.error === "tooMany" ? "form.errors.tooMany" : "form.errors.unavailable")
      : invalid.size > 0
        ? t("form.errors.form")
        : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const parsed = demoRequestSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      event.preventDefault();
      const fields = new Set(parsed.error.issues.map((issue) => issue.path[0] as DemoRequestField));
      setClientErrors(fields);
      const first = DEMO_REQUEST_FIELDS.find((field) => fields.has(field));
      if (first) (form.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    setClientErrors(new Set());
    if (elapsed.current) {
      elapsed.current.value = String(Math.round((performance.now() - openedAt.current) / 1000));
    }
  }

  // Une correction efface l'erreur du champ sans attendre l'envoi suivant.
  function clearError(field: DemoRequestField) {
    if (!clientErrors.has(field)) return;
    setClientErrors((current) => {
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  }

  const field = (name: DemoRequestField) => ({
    id: `demo-${name}`,
    name,
    defaultValue: values?.[name] ?? "",
    "aria-invalid": invalid.has(name) || undefined,
    "aria-describedby": invalid.has(name) ? `demo-${name}-error` : undefined,
    onChange: () => clearError(name),
  });

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="rounded-2xl bg-card p-6 shadow-border sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="fullName" invalid={invalid.has("fullName")}>
          <input {...field("fullName")} autoComplete="name" required className={INPUT} />
        </Field>
        <Field name="gymName" invalid={invalid.has("gymName")}>
          <input {...field("gymName")} autoComplete="organization" required className={INPUT} />
        </Field>
        <Field name="email" invalid={invalid.has("email")}>
          <input
            {...field("email")}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("form.emailPlaceholder")}
            required
            className={INPUT}
          />
        </Field>
        <Field name="phone" invalid={invalid.has("phone")} optional>
          <input {...field("phone")} type="tel" autoComplete="tel" className={INPUT} />
        </Field>
        <Field name="city" invalid={invalid.has("city")}>
          <input {...field("city")} autoComplete="address-level2" required className={INPUT} />
        </Field>
        <Field name="membersBand" invalid={invalid.has("membersBand")}>
          <div className="relative">
            <select
              {...field("membersBand")}
              required
              className={cn(INPUT, "appearance-none pr-10")}
            >
              <option value="">{t("form.choose")}</option>
              {MEMBERS_BANDS.map((band) => (
                <option key={band} value={band}>
                  {t(`form.bands.${band}`)}
                </option>
              ))}
            </select>
            <CaretDownIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
          </div>
        </Field>
        <Field name="currentTool" invalid={invalid.has("currentTool")} optional wide>
          <input
            {...field("currentTool")}
            placeholder={t("form.toolPlaceholder")}
            className={INPUT}
          />
        </Field>
        <Field name="message" invalid={invalid.has("message")} optional wide>
          <textarea
            {...field("message")}
            rows={4}
            placeholder={t("form.messagePlaceholder")}
            className={cn(INPUT, "resize-y")}
          />
        </Field>
      </div>

      {/* Champ piège : invisible pour un humain, rempli par les robots. */}
      <div aria-hidden="true" className="sr-only">
        <label>
          Site web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input ref={elapsed} type="hidden" name="elapsed" />

      {formError && (
        <p role="alert" className="mt-6 text-sm font-medium text-destructive">
          {formError}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={cn(buttonClasses("primary"), "mt-6 w-full")}
      >
        {pending ? t("form.pending") : t("form.submit")}
      </button>
      <p className="mt-4 text-sm text-muted-foreground">
        {t("form.privacyBefore")}{" "}
        <Link href="/confidentialite" className="font-medium text-foreground underline">
          {t("form.privacyLink")}
        </Link>
        .
      </p>
    </form>
  );
}

const INPUT = cn(
  "block min-h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground",
  "placeholder:text-muted-foreground aria-invalid:border-destructive",
  "transition-colors duration-300 ease-base hover:border-neutral-500",
);

function Field({
  name,
  invalid,
  optional = false,
  wide = false,
  children,
}: {
  name: DemoRequestField;
  invalid: boolean;
  optional?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", wide && "sm:col-span-2")}>
      <label htmlFor={`demo-${name}`} className="text-sm font-medium">
        {t(`form.${name}`)}
        {optional && (
          <span className="font-normal text-muted-foreground"> ({t("form.optional")})</span>
        )}
      </label>
      {children}
      {invalid && (
        <p id={`demo-${name}-error`} className="text-sm text-destructive">
          {t(`form.errors.${name}`)}
        </p>
      )}
    </div>
  );
}
