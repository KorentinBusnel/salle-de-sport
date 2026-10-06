import {
  BotIcon,
  CalculatorIcon,
  CreditCardIcon,
  LandmarkIcon,
  type LucideIcon,
  MailIcon,
  MessageCircleIcon,
} from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { aiEnv } from "@/lib/env.server";
import { gymFormatters } from "@/lib/format";
import { type MessageKey, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

type Provider = {
  key: "claude" | "gmail" | "whatsapp" | "qonto" | "pennylane" | "stripe";
  icon: LucideIcon;
  status: "connected" | "missing" | "later" | "payments";
  detail?: string | undefined;
  account?: string | null | undefined;
  syncedAt?: string | null | undefined;
};

const STATUS: Record<
  Provider["status"],
  { tone: "success" | "warning" | "neutral"; key: MessageKey }
> = {
  connected: { tone: "success", key: "integrations.status.connected" },
  missing: { tone: "warning", key: "integrations.status.missing" },
  later: { tone: "neutral", key: "integrations.status.later" },
  payments: { tone: "neutral", key: "integrations.status.payments" },
};

/** Intégrations du Hub 360° : état de chaque service (aucun secret affiché). */
export async function IntegrationsSection({
  gymId,
  timezone,
}: {
  gymId: string;
  timezone: string;
}) {
  const format = gymFormatters(timezone);
  const ai = aiEnv();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("integrations")
    .select("provider, status, account_label, last_synced_at")
    .eq("gym_id", gymId);
  const connected = (provider: string) =>
    (rows ?? []).some((r) => r.provider === provider && r.status === "connected");
  const row = (provider: string) => {
    const found = (rows ?? []).find((r) => r.provider === provider);
    return { account: found?.account_label ?? null, syncedAt: found?.last_synced_at ?? null };
  };

  const providers: Provider[] = [
    {
      key: "claude",
      icon: BotIcon,
      status: ai.apiKey ? "connected" : "missing",
      detail: ai.apiKey ? t("integrations.model", { model: ai.model }) : undefined,
    },
    {
      key: "gmail",
      icon: MailIcon,
      status: connected("gmail") ? "connected" : "later",
      ...row("gmail"),
    },
    {
      key: "whatsapp",
      icon: MessageCircleIcon,
      status: connected("whatsapp") ? "connected" : "later",
      ...row("whatsapp"),
    },
    // Qonto : connecteur prévu (BRIEF §12), pas encore de fournisseur dans `integrations`.
    { key: "qonto", icon: LandmarkIcon, status: "later" },
    {
      key: "pennylane",
      icon: CalculatorIcon,
      status: connected("pennylane") ? "connected" : "later",
      ...row("pennylane"),
    },
    { key: "stripe", icon: CreditCardIcon, status: "payments" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {providers.map((p) => {
        const Icon = p.icon;
        const status = STATUS[p.status];
        return (
          <Card key={p.key}>
            <CardHeader className="flex flex-row items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="size-4.5" aria-hidden />
              </span>
              <div className="grid flex-1 gap-1">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  {t(`integrations.${p.key}.name`)}
                  <StatusPill tone={status.tone}>{t(status.key)}</StatusPill>
                </CardTitle>
                <CardDescription>{t(`integrations.${p.key}.hint`)}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>{p.detail ?? t(`integrations.${p.key}.next`)}</p>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-self-start">
                    {t("integrations.details")}
                  </Button>
                </SheetTrigger>
                <SheetContent className="sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Icon className="size-4.5" aria-hidden />
                      {t(`integrations.${p.key}.name`)}
                    </SheetTitle>
                    <SheetDescription>{t(`integrations.${p.key}.hint`)}</SheetDescription>
                  </SheetHeader>
                  <SheetBody>
                    <dl className="grid gap-4 text-sm">
                      <div className="grid gap-1">
                        <dt className="text-muted-foreground">{t("integrations.statusLabel")}</dt>
                        <dd>
                          <StatusPill tone={status.tone}>{t(status.key)}</StatusPill>
                        </dd>
                      </div>
                      {p.detail ? (
                        <div className="grid gap-1">
                          <dt className="text-muted-foreground">
                            {t("integrations.configuration")}
                          </dt>
                          <dd>{p.detail}</dd>
                        </div>
                      ) : null}
                      {p.account ? (
                        <div className="grid gap-1">
                          <dt className="text-muted-foreground">{t("integrations.account")}</dt>
                          <dd>{p.account}</dd>
                        </div>
                      ) : null}
                      {p.status === "connected" && p.key !== "claude" ? (
                        <div className="grid gap-1">
                          <dt className="text-muted-foreground">{t("integrations.lastSync")}</dt>
                          <dd className="tabular-nums">
                            {p.syncedAt ? format.dateTime(p.syncedAt) : t("integrations.never")}
                          </dd>
                        </div>
                      ) : null}
                      <div className="grid gap-1">
                        <dt className="text-muted-foreground">{t("integrations.howTo")}</dt>
                        <dd>{t(`integrations.${p.key}.next`)}</dd>
                      </div>
                    </dl>
                    <p className="mt-6 text-xs text-muted-foreground">
                      {t("integrations.noSecret")}
                    </p>
                  </SheetBody>
                </SheetContent>
              </Sheet>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
