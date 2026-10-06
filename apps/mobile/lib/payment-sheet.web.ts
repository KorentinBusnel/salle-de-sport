import type { PaymentSheetParams } from "@/lib/billing";
import { t } from "@/lib/i18n";
import type { SheetOutcome } from "./payment-sheet";

/** Version web de l'app (tests navigateur) : le SDK Stripe natif n'existe pas, achat à l'accueil. */
export async function presentPurchase(
  _params: PaymentSheetParams,
  _options: { merchantName: string; email: string | null; name: string },
): Promise<SheetOutcome> {
  return { status: "failed", message: t("offers.webUnsupported") };
}
