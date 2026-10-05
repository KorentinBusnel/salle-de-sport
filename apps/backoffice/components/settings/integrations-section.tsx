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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { aiEnv } from "@/lib/env.server";
import { type MessageKey, t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

type Provider = {
  key: "claude" | "gmail" | "whatsapp" | "qonto" | "pennylane" | "stripe";
  icon: LucideIcon;
  status: "connected" | "missing" | "later" | "payments";
  detail?: string | undefined;
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
export async function IntegrationsSection({ gymId }: { gymId: string }) {
  const ai = aiEnv();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("integrations")
    .select("provider, status, account_label, last_synced_at")
    .eq("gym_id", gymId);
  const connected = (provider: string) =>
    (rows ?? []).some((r) => r.provider === provider && r.status === "connected");

  const providers: Provider[] = [
    {
      key: "claude",
      icon: BotIcon,
      status: ai.apiKey ? "connected" : "missing",
      detail: ai.apiKey ? t("integrations.model", { model: ai.model }) : undefined,
    },
    { key: "gmail", icon: MailIcon, status: connected("gmail") ? "connected" : "later" },
    {
      key: "whatsapp",
      icon: MessageCircleIcon,
      status: connected("whatsapp") ? "connected" : "later",
    },
    // Qonto : connecteur prévu (BRIEF §12), pas encore de fournisseur dans `integrations`.
    { key: "qonto", icon: LandmarkIcon, status: "later" },
    {
      key: "pennylane",
      icon: CalculatorIcon,
      status: connected("pennylane") ? "connected" : "later",
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
            <CardContent className="text-sm text-muted-foreground">
              {p.detail ?? t(`integrations.${p.key}.next`)}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
