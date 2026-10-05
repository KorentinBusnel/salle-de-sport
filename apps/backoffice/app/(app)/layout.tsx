import { ShieldOffIcon } from "lucide-react";
import { navBadgesFor } from "@salle/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { NavBadge } from "@/components/nav-badge";
import { PageCrumbProvider } from "@/components/page-crumb";
import type { NewMenuItem } from "@/components/new-menu";
import { SubmitButton } from "@/components/submit-button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getTeamContext, isFrontDeskRole, isManagerRole } from "@/lib/auth";
import { getOwnCoachId } from "@/lib/coaches";
import { buildNavigation, type BadgeKey } from "@/lib/navigation";
import { t } from "@/lib/i18n";
import { getGymConfig } from "@/lib/settings";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const result = await getTeamContext();
  if (result.status === "anonymous") redirect("/login");

  if (result.status === "no-team") {
    return (
      <main className="grid min-h-svh place-items-center px-4">
        <Empty className="max-w-md">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldOffIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>
              <h1>{t("noAccess.title")}</h1>
            </EmptyTitle>
            <EmptyDescription>{t("noAccess.body")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <form action={signOut}>
              <SubmitButton variant="outline" pendingLabel={t("nav.signingOut")}>
                {t("nav.signOut")}
              </SubmitButton>
            </form>
          </EmptyContent>
        </Empty>
      </main>
    );
  }

  const { context } = result;
  const manager = isManagerRole(context.role);
  const frontDesk = isFrontDeskRole(context.role);

  // Seules les lectures légères et mises en cache bloquent la coque ; les pastilles arrivent à part.
  const [config, ownCoachId] = await Promise.all([
    getGymConfig(context.gym.id),
    // Coach sans rôle de gestion : sa fiche (disponibilités) et ses heures.
    manager ? null : getOwnCoachId(context.userId, context.gym.id),
  ]);
  const settings = config.settings;
  const navigation = buildNavigation(context.role, {
    ownCoachId,
    badges: navBadgesFor(context.role, config.private),
  });
  const badges: Partial<Record<BadgeKey, ReactNode>> = {};
  for (const item of [...navigation.groups.flatMap((group) => group.items), ...navigation.footer]) {
    if (item.badge) {
      badges[item.badge] = (
        <Suspense fallback={null}>
          <NavBadge gymId={context.gym.id} kind={item.badge} />
        </Suspense>
      );
    }
  }
  const crumbs = [
    ...navigation.groups.flatMap((group) =>
      group.items.map((item) => ({ href: item.href, label: item.label, group: group.label })),
    ),
    ...navigation.footer.map((item) => ({
      href: item.href,
      label: item.label,
      group: t("nav.groupSettings"),
    })),
  ];
  const create: NewMenuItem[] = [
    ...(frontDesk && (manager || settings.staff_can_create_members)
      ? [{ kind: "member" as const, href: "/adherents?nouveau=1" }]
      : []),
    ...(manager
      ? [
          { kind: "session" as const, href: "/planning" },
          { kind: "campaign" as const, href: "/emailing" },
        ]
      : []),
  ];

  const sidebarState = (await cookies()).get("sidebar_state")?.value;

  return (
    <PageCrumbProvider>
      <SidebarProvider defaultOpen={sidebarState !== "false"}>
        <a
          href="#contenu"
          className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm shadow-border focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          {t("nav.skipToContent")}
        </a>
        <AppSidebar
          gymName={config.identity.name || context.gym.name}
        gymLogoUrl={config.identity.logoUrl}
          displayName={context.displayName}
          roleLabel={t(`roles.${context.role}`)}
          groups={navigation.groups}
          footer={navigation.footer}
          badges={badges}
          signOut={signOut}
        />
        <SidebarInset className="min-w-0 bg-card md:peer-data-[variant=inset]:shadow-border">
          <AppTopbar crumbs={crumbs} search={frontDesk} assistant={manager} create={create} />
          <main id="contenu" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </PageCrumbProvider>
  );
}
