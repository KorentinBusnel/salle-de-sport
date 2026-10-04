"use client";

import { EyeIcon, EyeOffIcon, TriangleAlertIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { type MessageKey, t } from "@/lib/i18n";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export function LoginForm({ notice }: { notice?: MessageKey | undefined }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [typing, setTyping] = useState(false);
  // Champ contrôlé : React réinitialise le formulaire après chaque envoi, l'email doit rester.
  const [email, setEmail] = useState("");
  // Le motif de redirection (session refusée…) s'efface dès qu'on ressaisit.
  const error = state.error ?? (typing ? null : (notice ?? null));

  return (
    <form action={formAction} onChange={() => setTyping(true)} className="grid gap-6">
      {error ? (
        <Alert variant="destructive" className="bg-destructive/10">
          <TriangleAlertIcon />
          <AlertTitle>{t("login.errorTitle")}</AlertTitle>
          <AlertDescription>
            <p>{t(error)}</p>
            {state.detail ? (
              <details className="mt-1 text-xs">
                <summary className="cursor-pointer">{t("login.technicalDetail")}</summary>
                <code>{state.detail}</code>
              </details>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">{t("login.email")}</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoFocus
            required
            className="h-10"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{t("login.password")}</FieldLabel>
          <InputGroup className="h-10">
            <InputGroupInput
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" disabled={pending} className="h-11">
        {pending ? <Spinner data-icon="inline-start" /> : null}
        {pending ? t("login.submitting") : t("login.submit")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">{t("login.forgotPassword")}</p>
    </form>
  );
}
