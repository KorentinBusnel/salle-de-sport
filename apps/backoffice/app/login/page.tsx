import { CalendarCheckIcon, ClipboardCheckIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { type MessageKey, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

const NOTICES: Record<string, MessageKey> = {
  "sans-role": "login.noTeamRole",
  session: "login.sessionRejected",
};

export const metadata: Metadata = { title: t("login.title") };

/** La salle, si une seule utilise cet espace : son nom et son logo en tête de page. */
async function singleGym() {
  const supabase = await createClient();
  const { data } = await supabase.from("gyms").select("name, logo_path").limit(2);
  if (data?.length !== 1 || !data[0]) return null;
  const { name, logo_path: path } = data[0];
  return {
    name,
    logoUrl: path ? supabase.storage.from("gym-assets").getPublicUrl(path).data.publicUrl : null,
  };
}

function GymMark({
  gym,
  inverted,
}: {
  gym: { name: string; logoUrl: string | null };
  inverted?: boolean;
}) {
  return (
    <span className="flex items-center gap-3">
      <Avatar className="size-10 rounded-xl">
        {gym.logoUrl ? (
          <AvatarImage src={gym.logoUrl} alt="" className="rounded-[inherit] object-contain" />
        ) : null}
        <AvatarFallback
          className={
            inverted
              ? "rounded-xl bg-white/15 font-semibold text-primary-foreground"
              : "rounded-xl bg-primary font-semibold text-primary-foreground"
          }
        >
          {initials(gym.name)}
        </AvatarFallback>
      </Avatar>
      <span className="grid leading-tight">
        <span className="text-lg font-semibold">{gym.name}</span>
        <span
          className={
            inverted ? "text-sm text-primary-foreground/80" : "text-sm text-muted-foreground"
          }
        >
          {t("app.title")}
        </span>
      </span>
    </span>
  );
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { motif } = await searchParams;
  const gym = await singleGym();
  const highlights = [
    { icon: CalendarCheckIcon, text: t("login.highlightPlanning") },
    { icon: ClipboardCheckIcon, text: t("login.highlightAttendance") },
    { icon: UsersIcon, text: t("login.highlightMembers") },
  ];
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          aria-hidden
          className="absolute -top-32 -right-32 size-[28rem] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18),transparent_65%)]"
        />
        {gym ? (
          <GymMark gym={gym} inverted />
        ) : (
          <p className="text-lg font-semibold">{t("app.title")}</p>
        )}
        <div className="relative grid gap-6">
          <h2 className="max-w-md text-3xl leading-tight font-semibold">{t("login.tagline")}</h2>
          <ul className="grid gap-3">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-primary-foreground/90">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-primary-foreground/80">{t("login.footer")}</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <div className="grid w-full max-w-sm gap-8">
          {gym ? (
            <div className="lg:hidden">
              <GymMark gym={gym} />
            </div>
          ) : null}
          <div className="grid gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{t("login.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
          </div>
          <LoginForm notice={motif ? NOTICES[String(motif)] : undefined} />
        </div>
      </section>
    </main>
  );
}
