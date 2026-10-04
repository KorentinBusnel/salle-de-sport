"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Bouton d'envoi d'un formulaire de Server Action : désactivé avec un indicateur pendant l'envoi. */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? <Spinner data-icon="inline-start" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
