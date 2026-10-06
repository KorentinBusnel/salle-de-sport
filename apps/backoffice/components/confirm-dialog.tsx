"use client";

import { type ReactNode, useId, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";

/**
 * Confirmation avant une action sensible (annuler une séance, envoyer une campagne, résilier,
 * supprimer) : le formulaire de la Server Action est dans la boîte de dialogue. `tone`
 * « destructive » pour l'irréversible ; `requireAck` exige de cocher « Je comprends ».
 * Les actions réversibles passent plutôt par un toast « Annuler » (lib/toast-undo.ts).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  action,
  fields,
  children,
  tone = "destructive",
  requireAck,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  children?: ReactNode;
  tone?: "destructive" | "default" | undefined;
  /** Texte de la case à cocher obligatoire avant de confirmer (envois de masse…). */
  requireAck?: string | undefined;
}) {
  const ackId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <AlertDialog onOpenChange={(open) => !open && setAcknowledged(false)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <form action={action} className="grid gap-4">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {children}
          {requireAck ? (
            <div className="flex items-start gap-2.5 rounded-lg bg-muted/60 p-3">
              <Checkbox
                id={ackId}
                checked={acknowledged}
                onCheckedChange={(value) => setAcknowledged(value === true)}
                className="mt-0.5"
              />
              <Label htmlFor={ackId} className="text-sm leading-snug font-normal">
                {requireAck}
              </Label>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t("common.cancel")}</AlertDialogCancel>
            <SubmitButton
              variant={tone === "destructive" ? "destructive" : "default"}
              disabled={Boolean(requireAck) && !acknowledged}
            >
              {confirmLabel}
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
