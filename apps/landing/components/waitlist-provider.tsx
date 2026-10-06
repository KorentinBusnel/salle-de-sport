"use client";

import { createContext, useActionState, useContext, useEffect, useState } from "react";
import { joinWaitlist } from "@/app/actions";
import { track } from "@/lib/analytics";
import type { Placement, WaitlistState } from "@/lib/waitlist-schema";

type WaitlistContextValue = {
  state: WaitlistState;
  action: (formData: FormData) => void;
  pending: boolean;
  /** Formulaire envoyé en dernier : lui seul affiche l'attente et les erreurs. */
  submitting: Placement | null;
  markSubmitting: (placement: Placement) => void;
};

const WaitlistContext = createContext<WaitlistContextValue | null>(null);

/**
 * Une seule inscription pour la page : les deux formulaires (hero et rappel final) partagent la
 * même Server Action, si bien qu'une inscription réussie s'affiche dans les deux.
 */
export function WaitlistProvider({ children }: { children: React.ReactNode }) {
  const [state, action, pending] = useActionState(joinWaitlist, { status: "idle" });
  const [submitting, setSubmitting] = useState<Placement | null>(null);

  useEffect(() => {
    if (state.status === "joined" || state.status === "already_joined") {
      track({
        name: "inscription_succes",
        props: { emplacement: state.placement, statut: state.status },
      });
    }
  }, [state]);

  return (
    <WaitlistContext value={{ state, action, pending, submitting, markSubmitting: setSubmitting }}>
      {children}
    </WaitlistContext>
  );
}

export function useWaitlist(): WaitlistContextValue {
  const value = useContext(WaitlistContext);
  if (!value) throw new Error("useWaitlist hors de WaitlistProvider");
  return value;
}
