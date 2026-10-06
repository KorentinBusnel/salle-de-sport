"use client";

import { BracesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { saveTemplate } from "@/app/(app)/emailing/actions";
import { TextareaWithCount } from "@/components/forms/textarea-with-count";
import { MemberPicker, type PickedMember } from "@/components/members/member-picker";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";

/** Variables rendues en SQL (private.render_template), dans l'ordre de la barre. */
const VARIABLES = [
  { token: "{prenom}", label: "emailing.variable.firstName" },
  { token: "{nom}", label: "emailing.variable.lastName" },
  { token: "{salle}", label: "emailing.variable.gym" },
] as const;

type Preview = { subject: string; body: string; member_name: string | null };

/**
 * Modèle d'email : barre d'insertion des variables (au curseur, dans l'objet ou le message),
 * aperçu au fil de la frappe pour l'adhérent choisi (le premier actif à défaut), rendu comme à
 * l'envoi. L'enregistrement reste une Server Action de formulaire.
 */
export function TemplateEditor({
  template,
}: {
  template: { id: string; name: string; subject: string; body: string } | null;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [member, setMember] = useState<PickedMember | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<"subject" | "body">("body");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/emailing/apercu", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subject, body, memberId: member?.id ?? null }),
          signal: controller.signal,
        });
        if (response.ok) setPreview((await response.json()) as Preview);
      } catch {
        // Frappe plus récente : requête abandonnée.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [subject, body, member]);

  function insert(token: string) {
    const field = lastField.current === "subject" ? subjectRef.current : bodyRef.current;
    const value = lastField.current === "subject" ? subject : body;
    const set = lastField.current === "subject" ? setSubject : setBody;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    set(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{template?.name ?? t("emailing.newTemplate")}</CardTitle>
          <CardDescription>{t("emailing.variablesHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveTemplate} className="grid gap-4">
            {template ? <input type="hidden" name="templateId" value={template.id} /> : null}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="tpl-name">{t("emailing.templateName")}</FieldLabel>
                <Input
                  id="tpl-name"
                  name="name"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <div
                role="toolbar"
                aria-label={t("emailing.insertVariable")}
                className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted/60 p-1.5"
              >
                <BracesIcon className="ml-1 size-4 text-muted-foreground" aria-hidden />
                <span className="mr-1 text-xs text-muted-foreground">
                  {t("emailing.insertVariable")}
                </span>
                {VARIABLES.map((variable) => (
                  <Button
                    key={variable.token}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 bg-card font-mono text-xs pointer-coarse:h-10"
                    // Le champ garde le focus et la position du curseur.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insert(variable.token)}
                    title={t(variable.label)}
                  >
                    {variable.token}
                  </Button>
                ))}
              </div>
              <Field>
                <FieldLabel htmlFor="tpl-subject">{t("emailing.subject")}</FieldLabel>
                <Input
                  ref={subjectRef}
                  id="tpl-subject"
                  name="subject"
                  required
                  maxLength={200}
                  value={subject}
                  onFocus={() => (lastField.current = "subject")}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="tpl-body">{t("emailing.body")}</FieldLabel>
                <TextareaWithCount
                  ref={bodyRef}
                  id="tpl-body"
                  name="body"
                  required
                  rows={10}
                  maxLength={10000}
                  value={body}
                  onFocus={() => (lastField.current = "body")}
                  onChange={(event) => setBody(event.target.value)}
                />
              </Field>
            </FieldGroup>
            <SubmitButton className="w-fit">{t("common.save")}</SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-muted/40 xl:sticky xl:top-20">
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2">
            <CardTitle>{t("emailing.preview")}</CardTitle>
            {loading ? <Spinner /> : null}
          </div>
          <MemberPicker
            value={member}
            onChange={setMember}
            label={t("emailing.previewMember")}
            placeholder={
              preview?.member_name && !member
                ? t("emailing.previewDefault", { name: preview.member_name })
                : t("emailing.previewMember")
            }
          />
        </CardHeader>
        <CardContent
          aria-live="polite"
          className="mx-6 grid gap-3 rounded-lg bg-card p-4 text-sm shadow-border"
        >
          {preview ? (
            <>
              <p className="font-semibold">{preview.subject || "—"}</p>
              <p className="whitespace-pre-line text-muted-foreground">{preview.body || "—"}</p>
              {!preview.member_name ? (
                <p className="text-xs text-muted-foreground">{t("emailing.previewNoMember")}</p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">{t("ui.loading")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
