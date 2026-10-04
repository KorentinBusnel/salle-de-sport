import { PIPELINE_STAGES, type PipelineStage } from "@salle/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { isManagerRole, requireRole } from "@/lib/auth";
import { currentTime } from "@/lib/clock";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { moveMemberStage } from "./actions";

export const metadata: Metadata = { title: t("crm.title") };

const PER_COLUMN = 25;
const MORE_HREF: Record<PipelineStage, string> = {
  lead: "/adherents?statut=prospect",
  trial: "/adherents?statut=prospect&tag=essai",
  active: "/adherents?statut=active",
  suspended: "/adherents?statut=suspended",
  cancelled: "/adherents?statut=cancelled",
};

/** Pipeline : étapes déduites des fiches (statut, réservations, tag « essai »), en glisser-déposer. */
export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_pipeline", { p_gym_id: context.gym.id });
  if (error) throw new Error(error.message);
  const now = currentTime().getTime();
  const relative = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  const ago = (at: string | null) => {
    if (!at) return "";
    const days = Math.round((Date.parse(at) - now) / 86_400_000);
    return Math.abs(days) < 1 ? t("crm.today") : relative.format(days, "day");
  };

  const columns = PIPELINE_STAGES.map((stage) => {
    const rows = (data ?? []).filter((r) => r.stage === stage);
    return {
      stage,
      total: rows.length,
      cards: rows.slice(0, PER_COLUMN).map((r) => ({
        id: r.member_id,
        name: `${r.first_name} ${r.last_name}`,
        contact: r.email ?? r.phone ?? "—",
        bookings: r.bookings,
        lastActivity: ago(r.last_activity_at),
      })),
    };
  });

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
      <PipelineBoard columns={columns} moreHref={MORE_HREF} action={moveMemberStage} />
    </div>
  );
}
