import { Trash2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmailingNav } from "@/components/emailing-nav";
import { TemplateEditor } from "@/components/emailing/template-editor";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { isManagerRole, requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { deleteTemplate } from "../actions";

export const metadata: Metadata = { title: t("emailing.tab.templates") };

/** Modèles d'emails : barre de variables {prenom}, {nom}, {salle} ; aperçu en direct sur un adhérent choisi. */
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

        <div className="grid gap-3">
          {current ? (
            <div className="justify-self-end">
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon data-icon="inline-start" aria-hidden />
                    {t("emailing.deleteTemplate")}
                  </Button>
                }
                title={t("emailing.deleteTemplateTitle", { name: current.name })}
                description={t("emailing.deleteTemplateBody")}
                confirmLabel={t("common.delete")}
                action={deleteTemplate}
                fields={{ templateId: current.id }}
              />
            </div>
          ) : null}
          <TemplateEditor key={current?.id ?? "new"} template={current ?? null} />
        </div>
      </div>
    </div>
  );
}
