import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar, type NavGroup } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getTeamContext, isFrontDeskRole, isManagerRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
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

  // Prospects inscrits depuis l'app, en attente d'activation par l'accueil.
  let prospects = 0;
  if (frontDesk) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", context.gym.id)
      .eq("status", "prospect");
    prospects = count ?? 0;
  }

  const groups: NavGroup[] = [
    {
      label: t("nav.groupDaily"),
      items: [
        { href: "/", label: t("nav.today"), icon: "today" },
        { href: "/planning", label: t("nav.planning"), icon: "planning" },
      ],
    },
  ];
  if (frontDesk || manager) {
    groups.push({
      label: t("nav.groupManage"),
      items: [
        ...(frontDesk
          ? [
              {
                href: "/adherents",
                label: t("nav.members"),
                icon: "members" as const,
                badge: prospects,
              },
            ]
          : []),
        ...(manager
          ? [
              { href: "/planning/modeles", label: t("nav.templates"), icon: "templates" as const },
              { href: "/messages", label: t("nav.messages"), icon: "messages" as const },
            ]
          : []),
      ],
    });
  }
  if (manager) {
    groups.push({
      label: t("nav.groupAdmin"),
      items: [{ href: "/parametres", label: t("nav.settings"), icon: "settings" }],
    });
  }

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
        groups={groups}
        signOut={signOut}
      />
      <SidebarInset className="min-w-0 bg-card md:peer-data-[variant=inset]:shadow-border">
        <AppTopbar search={frontDesk} />
        <main id="contenu" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
