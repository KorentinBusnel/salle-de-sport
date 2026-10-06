import type { ReactElement } from "react";

/** Web : pas de SDK Stripe natif. */
export function PaymentsProvider({ children }: { children: ReactElement | ReactElement[] }) {
  return <>{children}</>;
}
