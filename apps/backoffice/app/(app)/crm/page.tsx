import { PIPELINE_STAGES, type PipelineStage } from "@salle/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { t } from "@/lib/i18n";
import { getGymSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { startTrial } from "../adherents/[id]/actions";
import { setMemberStatus } from "../adherents/actions";

export const metadata: Metadata = { title: t("crm.title") };

const PER_COLUMN = 25;
const ACCENT: Record<PipelineStage, string> = {
  lead: "bg-primary",
  trial: "bg-warning",
  active: "bg-success",
  suspended: "bg-neutral-400",
  cancelled: "bg-neutral-300",
};

/** Pipeline : étapes déduites des fiches (statut, réservations, tag « essai »). */
export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const settings = await getGymSettings(context.gym.id);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_pipeline", { p_gym_id: context.gym.id });
  if (error) throw new Error(error.message);
  const now = currentTime().getTime();

  const columns = PIPELINE_STAGES.map((stage) => {
    const rows = (data ?? []).filter((r) => r.stage === stage);
    return { stage, total: rows.length, rows: rows.slice(0, PER_COLUMN) };
  });
  const relative = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  const ago = (at: string | null) => {
    if (!at) return "";
    const days = Math.round((Date.parse(at) - now) / 86_400_000);
    return Math.abs(days) < 1 ? t("crm.today") : relative.format(days, "day");
  };

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        title={t("crm.title")}
        description={t("crm.hint")}
        actions={
          <Button asChild variant="outline">
            <Link href="/segments">{t("nav.segments")}</Link>
          </Button>
        }
      />
      <Flash ok={params.ok} error={params.erreur} />
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        <div className="grid min-w-[64rem] grid-cols-5 gap-3">
          {columns.map((column) => (
            <section
              key={column.stage}
              aria-labelledby={`col-${column.stage}`}
              className="grid content-start gap-2 rounded-xl bg-muted/60 p-2"
            >
              <h2
                id={`col-${column.stage}`}
                className="flex items-center gap-2 px-1 py-1 text-sm font-medium"
              >
                <span aria-hidden className={cn("size-2 rounded-full", ACCENT[column.stage])} />
                {t(`crm.stage.${column.stage}`)}
                <span className="ml-auto text-muted-foreground tabular-nums">{column.total}</span>
              </h2>
              {column.rows.map((row) => (
                <article
                  key={row.member_id}
                  className="relative grid gap-1.5 rounded-lg bg-card p-3 text-sm shadow-border"
                >
                  <Link
                    href={`/adherents/${row.member_id}`}
                    className="font-medium after:absolute after:inset-0 hover:underline"
                  >
                    {row.first_name} {row.last_name}
                  </Link>
                  <span className="truncate text-xs text-muted-foreground">
                    {row.email ?? row.phone ?? "—"}
                  </span>
                  <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{t("crm.bookings", { count: row.bookings })}</span>
                    <span className="shrink-0 whitespace-nowrap">{ago(row.last_activity_at)}</span>
                  </span>
                  {column.stage === "lead" ? (
                    <form action={startTrial} className="relative z-10">
                      <input type="hidden" name="memberId" value={row.member_id} />
                      <SubmitButton size="sm" variant="outline">
                        {t("crm.startTrial")}
                      </SubmitButton>
                    </form>
                  ) : column.stage === "trial" ||
                    (column.stage === "suspended" &&
                      (isManagerRole(context.role) || settings.staff_can_suspend_members)) ? (
                    <form action={setMemberStatus} className="relative z-10">
                      <input type="hidden" name="memberId" value={row.member_id} />
                      <input type="hidden" name="status" value="active" />
                      <input type="hidden" name="returnTo" value="/crm" />
                      <SubmitButton size="sm" variant="outline">
                        {column.stage === "trial" ? t("members.activate") : t("members.reactivate")}
                      </SubmitButton>
                    </form>
                  ) : null}
                </article>
              ))}
              {column.total > PER_COLUMN ? (
                <Link
                  href={
                    column.stage === "lead" || column.stage === "trial"
                      ? "/adherents?statut=prospect"
                      : `/adherents?statut=${column.stage}`
                  }
                  className="px-1 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("crm.more", { count: column.total - PER_COLUMN })}
                </Link>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
