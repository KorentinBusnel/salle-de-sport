"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { asMessageKey } from "@/lib/flash";
import { t } from "@/lib/i18n";

/**
 * Affiche en toast le message posé par withFlash (?ok=… / ?erreur=…) après une Server
 * Action, puis le retire de l'URL : il ne réapparaît ni au rechargement ni au retour.
 */
export function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const shown = useRef<string | null>(null);

  useEffect(() => {
    const ok = asMessageKey(params.get("ok"));
    const error = asMessageKey(params.get("erreur"));
    if (!ok && !error) return;
    const signature = `${pathname}?${params.toString()}`;
    if (shown.current === signature) return;
    shown.current = signature;

    if (error) toast.error(t(error), { closeButton: true, duration: 8000 });
    else if (ok) toast.success(t(ok));

    const next = new URLSearchParams(params.toString());
    next.delete("ok");
    next.delete("erreur");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return null;
}
