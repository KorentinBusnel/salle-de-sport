import { type HomeBlock, homeBlocksFor } from "@salle/shared";
import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SectionError } from "@/components/section-error";
import { AssistantOff } from "@/components/today/assistant-off";
import { BriefSection } from "@/components/today/brief-section";
import { ClientsSection } from "@/components/today/clients-section";
import { ClosureAlert } from "@/components/today/closure-alert";
import { FinanceSection } from "@/components/today/finance-section";
import { Greeting } from "@/components/today/greeting";
import { HomeSectionSkeleton } from "@/components/today/home-section";
import { LiveRefresh } from "@/components/today/live-refresh";
import { OperationsSection } from "@/components/today/operations-section";
import { SetupChecklist } from "@/components/today/setup-checklist";
import { Skeleton } from "@/components/ui/skeleton";
import { requireTeamContext } from "@/lib/auth";
import { aiEnv } from "@/lib/env.server";
import { gymFormatters } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getGymConfig } from "@/lib/settings";
import { getTodayFrame } from "@/lib/today";

export const metadata: Metadata = { title: t("nav.today") };

/**
 * Accueil orienté action : bloc Assistant (gérant : brief du jour et question libre), puis Opérations, Clients et Finance, dans
 * l'ordre réglé par le gérant pour chaque rôle. Chaque bloc se charge à part (Suspense) : le
 * premier prêt s'affiche sans attendre les autres, une erreur reste locale au bloc.
 */
export default async function DashboardPage() {
  const context = await requireTeamContext();
  const config = await getGymConfig(context.gym.id);
  const frame = getTodayFrame(context);
  const configured = frame.manager && aiEnv().apiKey !== null;
  const firstName = context.displayName.split(" ")[0] ?? context.displayName;

  const blocks: Record<HomeBlock, { content: ReactNode; fallback: ReactNode } | null> = {
    // Bloc Assistant (gérant) : brief et question libre, ou le chemin pour l'activer sans clé.
    brief: configured
      ? {
          content: <BriefSection context={context} />,
          fallback: <Skeleton className="h-40 rounded-2xl" />,
        }
      : frame.manager
        ? { content: <AssistantOff />, fallback: null }
        : null,
    operations: {
      content: <OperationsSection context={context} />,
      fallback: <HomeSectionSkeleton kpis={4} cards={2} list className="lg:grid-cols-2" />,
    },
    clients: frame.manager
      ? {
          content: <ClientsSection context={context} />,
          fallback: <HomeSectionSkeleton cards={1} className="lg:grid-cols-2" />,
        }
      : null,
    // Impayés : gérant et accueil (relancer, encaisser) ; le reste de la finance au gérant.
    finance: frame.frontDesk
      ? {
          content: <FinanceSection context={context} />,
          fallback: (
            <HomeSectionSkeleton
              cards={frame.manager ? 2 : 1}
              className={frame.manager ? "lg:grid-cols-2" : undefined}
            />
          ),
        }
      : null,
  };

  return (
    <div className="grid gap-8">
      <LiveRefresh gymId={context.gym.id} />
      <PageHeader
        title={
          <Suspense fallback={t("today.greetingShort", { name: firstName })}>
            <Greeting context={context} name={firstName} />
          </Suspense>
        }
        description={gymFormatters(frame.tz).longDay(frame.now)}
      />

      {frame.manager ? (
        <SectionError>
          <Suspense fallback={null}>
            <ClosureAlert context={context} />
          </Suspense>
          <Suspense fallback={null}>
            <SetupChecklist context={context} />
          </Suspense>
        </SectionError>
      ) : null}

      {homeBlocksFor(context.role, config.private).map((key) => {
        const block = blocks[key];
        return block ? (
          <SectionError key={key}>
            <Suspense fallback={block.fallback}>{block.content}</Suspense>
          </SectionError>
        ) : null;
      })}
    </div>
  );
}
