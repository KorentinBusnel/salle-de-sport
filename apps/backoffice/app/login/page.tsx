import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type MessageKey, t } from "@/lib/i18n";
import { LoginForm } from "./login-form";

const NOTICES: Record<string, MessageKey> = {
  "sans-role": "login.noTeamRole",
  session: "login.sessionRejected",
};

export const metadata: Metadata = { title: t("login.title") };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { motif } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("login.title")}</CardTitle>
          <CardDescription>{t("login.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm notice={motif ? NOTICES[String(motif)] : undefined} />
        </CardContent>
      </Card>
    </main>
  );
}
