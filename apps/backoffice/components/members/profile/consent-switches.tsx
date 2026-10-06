"use client";

import { useState } from "react";
import { setConsentQuick } from "@/app/(app)/adherents/[id]/actions";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";
import { toastUndo } from "@/lib/toast-undo";

type Channel = "email" | "whatsapp";

const outcome = (result: Awaited<ReturnType<typeof setConsentQuick>>) =>
  result.ok ? {} : { error: result.error };

/**
 * Consentements marketing : un interrupteur par canal. Un accord part tout de suite (« Annuler »
 * le retire) ; un retrait attend 10 s (« Annuler » garde l'accord et sa date d'origine). La base
 * journalise chaque changement.
 */
export function ConsentSwitches({
  memberId,
  consents,
  formatDate,
}: {
  memberId: string;
  consents: Record<Channel, string | null>;
  /** Dates déjà formatées (fuseau de la salle) : « Accordé le … ». */
  formatDate: Record<Channel, string | null>;
}) {
  const [shown, setShown] = useState<Record<Channel, boolean>>({
    email: consents.email !== null,
    whatsapp: consents.whatsapp !== null,
  });
  // Les données du serveur font foi dès qu'elles changent (après enregistrement).
  const [source, setSource] = useState(consents);
  if (source.email !== consents.email || source.whatsapp !== consents.whatsapp) {
    setSource(consents);
    setShown({ email: consents.email !== null, whatsapp: consents.whatsapp !== null });
  }

  function change(channel: Channel, granted: boolean) {
    setShown((current) => ({ ...current, [channel]: granted }));
    const label = t(`memberProfile.consent.${channel}`);
    if (granted) {
      toastUndo({
        message: t("memberProfile.consentGrantedFor", { channel: label }),
        mode: "inverse",
        id: `consent-${channel}-${memberId}`,
        run: async () => outcome(await setConsentQuick({ memberId, channel, granted: true })),
        undo: async () => {
          setShown((current) => ({ ...current, [channel]: false }));
          return outcome(await setConsentQuick({ memberId, channel, granted: false }));
        },
      });
      return;
    }
    toastUndo({
      message: t("memberProfile.consentWithdrawnFor", { channel: label }),
      mode: "deferred",
      run: async () => {
        const result = await setConsentQuick({ memberId, channel, granted: false });
        if (!result.ok) setShown((current) => ({ ...current, [channel]: true }));
        return outcome(result);
      },
      onUndo: () => setShown((current) => ({ ...current, [channel]: true })),
    });
  }

  return (
    <ul className="grid gap-3">
      {(["email", "whatsapp"] as const).map((channel) => (
        <li key={channel} className="flex items-center justify-between gap-3">
          <span className="text-sm">
            <span className="block font-medium">{t(`memberProfile.consent.${channel}`)}</span>
            <span className="text-muted-foreground">
              {shown[channel]
                ? formatDate[channel]
                  ? t("memberProfile.consentSince", { date: formatDate[channel] })
                  : t("memberProfile.consentNow")
                : t("memberProfile.noConsent")}
            </span>
          </span>
          <Switch
            checked={shown[channel]}
            onCheckedChange={(checked) => change(channel, checked)}
            aria-label={t(`memberProfile.consent.${channel}`)}
          />
        </li>
      ))}
    </ul>
  );
}
