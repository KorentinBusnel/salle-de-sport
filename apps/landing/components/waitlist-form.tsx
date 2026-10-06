"use client";

import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";
import { form } from "@/content/landing";
import { useWaitlist } from "@/components/waitlist-provider";
import { track } from "@/lib/analytics";
import type { Placement } from "@/lib/waitlist-schema";

const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign"] as const;

// Paramètres de l'adresse courante, lus au rendu côté client (rien n'est stocké dans le navigateur).
const noSubscribe = () => () => {};
function useSearch(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => window.location.search,
    () => "",
  );
}

type Props = {
  placement: Placement;
  /** `onPhoto` : texte clair sur la photo du hero ; `onCard` : rappel final, carte blanche. */
  variant: "onPhoto" | "onCard";
};

/**
 * Formulaire de la liste d'attente : email, consentement non pré-coché, honeypot et UTM cachés.
 * Validation native du navigateur, puis Zod côté serveur (app/actions.ts).
 */
export function WaitlistForm({ placement, variant }: Props) {
  const { state, action, pending, submitting, markSubmitting } = useWaitlist();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const search = useSearch();
  const params = new URLSearchParams(search);
  const ids = useId();
  const onPhoto = variant === "onPhoto";

  if (state.status === "joined" || state.status === "already_joined") {
    const message =
      state.status === "already_joined" && state.placement === placement
        ? form.already
        : form.success[placement];
    return (
      <Notice onPhoto={onPhoto} tone="success">
        {message}
      </Notice>
    );
  }

  const isMine = submitting === placement;
  const busy = pending && isMine;
  const error =
    state.status === "error" && state.placement === placement && !busy ? state.error : null;
  const emailId = `${ids}-email`;
  const errorId = `${ids}-error`;

  return (
    <form
      action={action}
      onSubmit={() => {
        markSubmitting(placement);
        track({ name: "inscription_envoi", props: { emplacement: placement } });
      }}
      className={
        onPhoto
          ? "flex w-full max-w-[560px] flex-col gap-3 pt-2"
          : "flex w-full min-w-0 flex-col gap-3"
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={emailId} className="sr-only">
          {form.emailLabel}
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder={form.placeholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error === "email" || undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-12 w-full min-w-0 rounded-xl sm:w-auto sm:flex-1 border border-border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_0_0_3px_rgb(97_95_255/0.15)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-12 shrink-0 cursor-pointer rounded-lg bg-primary px-5 text-sm font-semibold tracking-[0.04em] text-primary-foreground uppercase transition-[background-color,scale,opacity] duration-150 hover:bg-primary-hover active:scale-[0.96] disabled:cursor-progress disabled:opacity-80"
        >
          {busy ? form.pending : form.submit[placement]}
        </button>
      </div>

      <label
        className={`flex items-start gap-2.5 text-[13px] leading-normal ${
          onPhoto ? "justify-center text-left text-white/90" : "text-muted-foreground"
        }`}
      >
        <input
          type="checkbox"
          name="consent"
          required
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          aria-invalid={error === "consent" || undefined}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span>
          {form.consent}{" "}
          <Link
            href="/confidentialite"
            className={`underline underline-offset-2 ${onPhoto ? "text-white" : "text-foreground"}`}
          >
            {form.privacyLink}
          </Link>
        </span>
      </label>

      <input type="hidden" name="placement" value={placement} />
      {UTM_FIELDS.map((name) => (
        <input key={name} type="hidden" name={name} value={params.get(name) ?? ""} />
      ))}
      {/* Honeypot : invisible et hors du parcours clavier ; un robot le remplit. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Site web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {error ? (
        <Notice onPhoto={onPhoto} tone="error" id={errorId}>
          {form.errors[error]}
        </Notice>
      ) : null}
    </form>
  );
}

function Notice({
  children,
  onPhoto,
  tone,
  id,
}: {
  children: React.ReactNode;
  onPhoto: boolean;
  tone: "success" | "error";
  id?: string;
}) {
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-center gap-3 rounded-xl border border-border bg-card px-[18px] py-3.5 text-left text-base leading-normal text-foreground ${
        onPhoto ? "w-full max-w-[560px]" : "w-full"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-2.5 shrink-0 rounded-full ${tone === "error" ? "bg-terracotta" : "bg-primary"}`}
      />
      {children}
    </div>
  );
}
