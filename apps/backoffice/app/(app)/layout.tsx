import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppNav, type NavItem } from "@/components/app-nav";
import { getTeamContext, isFrontDeskRole, isManagerRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
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
  const navItems: NavItem[] = [
    { href: "/", label: t("nav.today") },
    { href: "/planning", label: t("nav.planning") },
    ...(isManagerRole(context.role)
      ? [{ href: "/planning/modeles", label: t("nav.templates") }]
      : []),
    ...(isFrontDeskRole(context.role) ? [{ href: "/adherents", label: t("nav.members") }] : []),
    ...(isManagerRole(context.role) ? [{ href: "/parametres", label: t("nav.settings") }] : []),
  ];
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="font-semibold">{context.gym.name}</span>
          <span className="text-sm text-muted-foreground">{t("app.title")}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm">{context.displayName}</span>
            <Badge variant="secondary">{t(`roles.${context.role}`)}</Badge>
            <form action={signOut}>
              <Button variant="ghost" size="sm">
                {t("nav.signOut")}
              </Button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2">
          <AppNav items={navItems} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
