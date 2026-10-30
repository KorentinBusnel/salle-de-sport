"use client";

import { CheckCircleIcon } from "@phosphor-icons/react/ssr";
import { demoEmailSchema } from "@salle/shared";
import { type FormEvent, useActionState, useEffect, useRef, useState } from "react";
import { type DemoEmailState, requestDemo } from "@/app/actions";
import { buttonClasses } from "@/components/button";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { SECTIONS } from "@/lib/site";

const INITIAL: DemoEmailState = { status: "idle" };

/**
 * « Demander une démo » du hero : un champ email et un bouton, seul appel à l'action du site.
 * Le bouton de la barre mène ici (`#demo`) et donne le focus au champ. Sans JavaScript, le
 * formulaire s'envoie quand même (Server Action).
 */
export function DemoEmailForm() {
  const [state, formAction, pending] = useActionState(requestDemo, INITIAL);
  // Erreur relevée dans le navigateur avant l'envoi ; le serveur et la base revalident.
  const [clientInvalid, setClientInvalid] = useState(false);
  const openedAt = useRef(0);
  const elapsed = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const sent = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    openedAt.current = performance.now();
    const focusOnHash = () => {
      if (window.location.hash === `#${SECTIONS.demo}`) input.current?.focus();
    };
    focusOnHash();
    window.addEventListener("hashchange", focusOnHash);
    return () => window.removeEventListener("hashchange", focusOnHash);
  }, []);
  useEffect(() => {
    if (state.status === "sent") sent.current?.focus();
  }, [state.status]);

  if (state.status === "sent") {
    return (
      <p
        id={SECTIONS.demo}
        ref={sent}
        tabIndex={-1}
        role="status"
        className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-3 text-base font-medium shadow-border"
      >
        <CheckCircleIcon aria-hidden="true" className="size-5 shrink-0 text-success" />
        {t("hero.demo.sent", { email: state.email })}
      </p>
    );
  }

  const invalid = clientInvalid || state.status === "invalid";
  const error = invalid
    ? t("hero.demo.invalid")
    : state.status === "failed"
      ? t(state.error === "tooMany" ? "hero.demo.tooMany" : "hero.demo.unavailable")
      : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!demoEmailSchema.safeParse({ email: input.current?.value ?? "" }).success) {
      event.preventDefault();
      setClientInvalid(true);
      input.current?.focus();
      return;
    }
    setClientInvalid(false);
    if (elapsed.current) {
      elapsed.current.value = String(Math.round((performance.now() - openedAt.current) / 1000));
    }
  }

  return (
    <form
      id={SECTIONS.demo}
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="w-full max-w-md"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:rounded-full sm:bg-card sm:p-1 sm:shadow-border">
        <label htmlFor="demo-email" className="sr-only">
          {t("hero.demo.label")}
        </label>
        <input
          ref={input}
          id="demo-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder={t("hero.demo.label")}
          defaultValue={state.status === "idle" ? "" : state.email}
          aria-invalid={invalid || undefined}
          aria-describedby={error ? "demo-email-error" : undefined}
          onInput={() => {
            if (clientInvalid) setClientInvalid(false);
          }}
          className="min-h-12 w-full min-w-0 flex-1 rounded-full bg-card px-4 text-base text-foreground shadow-border placeholder:text-muted-foreground aria-invalid:shadow-none aria-invalid:ring-1 aria-invalid:ring-destructive sm:shadow-none"
        />
        <button
          type="submit"
          disabled={pending}
          className={cn(buttonClasses("primary", "small"), "min-h-12 shrink-0 px-6 text-base")}
        >
          {pending ? t("hero.demo.pending") : t("hero.demo.submit")}
        </button>
      </div>

      {/* Champ piège : invisible pour un humain, rempli par les robots. */}
      <div aria-hidden="true" className="sr-only">
        <label>
          Site web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input ref={elapsed} type="hidden" name="elapsed" />

      {error ? (
        <p id="demo-email-error" role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
