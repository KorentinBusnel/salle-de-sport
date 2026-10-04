import { Trash2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmailingNav } from "@/components/emailing-nav";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isManagerRole, requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { deleteTemplate, saveTemplate } from "../actions";

export const metadata: Metadata = { title: t("emailing.tab.templates") };

/** Modèles d'emails : variables {prenom}, {nom}, {salle} ; aperçu sur un vrai adhérent. */
export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ modele?: string; ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("email_templates")
    .select("id, name, subject, body")
    .eq("gym_id", context.gym.id)
    .order("name");
  const current = templates?.find((tpl) => tpl.id === params.modele);
  const { data: preview } = current
    ? await supabase
        .rpc("preview_template", {
          p_gym_id: context.gym.id,
          p_subject: current.subject,
          p_body: current.body,
        })
        .single()
    : { data: null };

  return (
    <div className="grid gap-6">
      <PageHeader title={t("emailing.title")} description={t("emailing.noDelivery")} />
      <EmailingNav current="/emailing/modeles" />
      <Flash ok={params.ok} error={params.erreur} />

      <div className="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label={t("emailing.tab.templates")} className="grid gap-1">
          <Link
            href="/emailing/modeles"
            aria-current={!current ? "page" : undefined}
            className={cn(
              "rounded-lg px-2 py-1.5 text-sm",
              !current ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted",
            )}
          >
            {t("emailing.newTemplate")}
          </Link>
          {(templates ?? []).map((tpl) => (
            <Link
              key={tpl.id}
              href={`/emailing/modeles?modele=${tpl.id}`}
              aria-current={tpl.id === current?.id ? "page" : undefined}
              className={cn(
                "truncate rounded-lg px-2 py-1.5 text-sm",
                tpl.id === current?.id
                  ? "bg-accent font-medium text-accent-foreground"
                  : "hover:bg-muted",
              )}
            >
              {tpl.name}
            </Link>
          ))}
        </nav>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="grid gap-1">
                <CardTitle>{current?.name ?? t("emailing.newTemplate")}</CardTitle>
                <CardDescription>{t("emailing.variablesHint")}</CardDescription>
              </div>
              {current ? (
                <form action={deleteTemplate}>
                  <input type="hidden" name="templateId" value={current.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("emailing.deleteTemplate")}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon />
                  </Button>
                </form>
              ) : null}
            </CardHeader>
            <CardContent>
              <form action={saveTemplate} className="grid gap-4" key={current?.id ?? "new"}>
                {current ? <input type="hidden" name="templateId" value={current.id} /> : null}
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="tpl-name">{t("emailing.templateName")}</FieldLabel>
                    <Input
                      id="tpl-name"
                      name="name"
                      required
                      maxLength={80}
                      defaultValue={current?.name ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="tpl-subject">{t("emailing.subject")}</FieldLabel>
                    <Input
                      id="tpl-subject"
                      name="subject"
                      required
                      maxLength={200}
                      defaultValue={current?.subject ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="tpl-body">{t("emailing.body")}</FieldLabel>
                    <Textarea
                      id="tpl-body"
                      name="body"
                      required
                      rows={10}
                      maxLength={10000}
                      defaultValue={current?.body ?? ""}
                    />
                    <FieldDescription>{t("emailing.variables")}</FieldDescription>
                  </Field>
                </FieldGroup>
                <SubmitButton className="w-fit">{t("common.save")}</SubmitButton>
              </form>
            </CardContent>
          </Card>

          {preview ? (
            <Card className="bg-muted/40">
              <CardHeader>
                <CardTitle>{t("emailing.preview")}</CardTitle>
                <CardDescription>
                  {preview.member_name
                    ? t("emailing.previewFor", { name: preview.member_name })
                    : t("emailing.previewNoMember")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 rounded-lg bg-card p-4 text-sm shadow-border">
                <p className="font-semibold">{preview.subject}</p>
                <p className="whitespace-pre-line text-muted-foreground">{preview.body}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
