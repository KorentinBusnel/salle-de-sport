import {
  initPaymentSheet,
  PaymentSheetError,
  presentPaymentSheet,
} from "@stripe/stripe-react-native";
import * as Linking from "expo-linking";
import type { PaymentSheetParams } from "@/lib/billing";
import { t } from "@/lib/i18n";

export type SheetOutcome =
  { status: "paid" } | { status: "canceled" } | { status: "failed"; message: string };

/**
 * Feuille de paiement Stripe (carte, Apple Pay / Google Pay selon l'appareil ; prélèvement SEPA
 * pour un abonnement). Les crédits et l'abonnement sont confirmés par le webhook, pas ici.
 */
export async function presentPurchase(
  params: PaymentSheetParams,
  options: { merchantName: string; email: string | null; name: string },
): Promise<SheetOutcome> {
  const init = await initPaymentSheet({
    merchantDisplayName: options.merchantName,
    paymentIntentClientSecret: params.clientSecret,
    ...(params.ephemeralKey
      ? { customerId: params.customerId, customerEphemeralKeySecret: params.ephemeralKey }
      : {}),
    allowsDelayedPaymentMethods: params.allowsDelayedPaymentMethods,
    returnURL: Linking.createURL("stripe-redirect"),
    defaultBillingDetails: {
      name: options.name,
      ...(options.email ? { email: options.email } : {}),
    },
  });
  if (init.error)
    return {
      status: "failed",
      message: init.error.localizedMessage ?? t("common.unexpectedError"),
    };
  const { error } = await presentPaymentSheet();
  if (!error) return { status: "paid" };
  if (error.code === PaymentSheetError.Canceled) return { status: "canceled" };
  return { status: "failed", message: error.localizedMessage ?? error.message };
}
