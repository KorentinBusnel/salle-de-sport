import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import type { NewMenuItem } from "@/components/new-menu";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getTeamContext, isFrontDeskRole, isManagerRole } from "@/lib/auth";
import { getOwnCoachId } from "@/lib/coaches";
import { buildNavigation } from "@/lib/navigation";
import { t } from "@/lib/i18n";
import { getGymSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const result = await getTeamContext();
  if (result.status === "anonymous") redirect("/login");

  if (result.status === "no-team") {
    return (
      <main className="mx-auto grid max-w-md gap-4 px-4 py-24">
        <h1 className="text-xl font-semibold">{t("noAccess.title")}</h1>
        <p className="text-muted-foreground">{t("noAccess.body")}</p>
        <form action={signOut}>
          <Button variant="outline">{t("nav.signOut")}</Button>
        </form>
      </main>
    );
  }

  const { context } = result;
  const manager = isManagerRole(context.role);
  const frontDesk = isFrontDeskRole(context.role);

  const supabase = await createClient();
  // Pastilles : prospects à activer (accueil et plus), messages sans réponse (gérant).
  const [prospectsResult, todoResult, settings] = await Promise.all([
    frontDesk
      ? supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("gym_id", context.gym.id)
          .eq("status", "prospect")
      : null,
    manager ? supabase.rpc("crm_todo", { p_gym_id: context.gym.id }) : null,
    getGymSettings(context.gym.id),
  ]);
  const prospects = prospectsResult?.count ?? 0;
  const unanswered = todoResult?.data?.find((row) => row.kind === "unanswered")?.total ?? 0;

  // Coach sans rôle de gestion : sa fiche (disponibilités) et ses heures.
  const ownCoachId = manager ? null : await getOwnCoachId(context.userId, context.gym.id);
  const navigation = buildNavigation(context.role, { prospects, unanswered, ownCoachId });
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
    <SidebarProvider defaultOpen={sidebarState !== "false"}>
      <a
        href="#contenu"
        className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm shadow-border focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("nav.skipToContent")}
      </a>
      <AppSidebar
        gymName={context.gym.name}
        displayName={context.displayName}
        roleLabel={t(`roles.${context.role}`)}
        groups={navigation.groups}
        footer={navigation.footer}
        signOut={signOut}
      />
      <SidebarInset className="min-w-0 bg-card md:peer-data-[variant=inset]:shadow-border">
        <AppTopbar crumbs={crumbs} search={frontDesk} assistant={manager} create={create} />
        <main id="contenu" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
