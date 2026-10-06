import { FileDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Téléchargement du reçu PDF d'un paiement encaissé (route /api/paiements/[id]/recu). */
export function ReceiptLink({ paymentId, date }: { paymentId: string; date: string }) {
  return (
    <Button asChild variant="ghost" size="icon-sm">
      <a
        href={`/api/paiements/${paymentId}/recu`}
        download
        aria-label={t("receipt.downloadOf", { date })}
        title={t("receipt.download")}
      >
        <FileDownIcon aria-hidden />
      </a>
    </Button>
  );
}
