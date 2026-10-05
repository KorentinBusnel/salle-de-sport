"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { asMessageKey, flashParams } from "@/lib/flash";
import { t } from "@/lib/i18n";

/**
 * Affiche en toast le message posé par withFlash (?ok=… / ?erreur=…) après une Server
 * Action, puis le retire de l'URL : il ne réapparaît ni au rechargement ni au retour.
 */
export function FlashToast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const shown = useRef<string | null>(null);

  useEffect(() => {
    const ok = asMessageKey(params.get("ok"));
    const error = asMessageKey(params.get("erreur"));
    if (!ok && !error) return;
    const signature = `${pathname}?${params.toString()}`;
    if (shown.current === signature) return;
    shown.current = signature;

    const values = flashParams(params.get("n"));
    if (error) toast.error(t(error, values), { closeButton: true, duration: 8000 });
    else if (ok) toast.success(t(ok, values));

    const next = new URLSearchParams(params.toString());
    next.delete("ok");
    next.delete("erreur");
    next.delete("n");
    const query = next.toString();
    // history.replaceState est synchronisé avec le routeur Next sans aller-retour serveur
    // (router.replace relançait le rendu de la page).
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }, [params, pathname]);

  return null;
}
