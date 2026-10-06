import { StripeProvider } from "@stripe/stripe-react-native";
import type { ReactElement } from "react";
import { env } from "@/lib/env";

/** Fournisseur Stripe (clé publiable) ; sans clé, l'app fonctionne sans achat en ligne. */
export function PaymentsProvider({ children }: { children: ReactElement | ReactElement[] }) {
  const key = env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return <>{children}</>;
  return (
    <StripeProvider publishableKey={key} urlScheme="salledesport">
      {children}
    </StripeProvider>
  );
}
