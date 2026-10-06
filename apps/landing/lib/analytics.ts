"use client";

import { track as vercelTrack } from "@vercel/analytics";

/** Événements mesurés (LANDING_BRIEF.md §7) ; la vue de page est comptée par <Analytics />. */
export type LandingEvent =
  | { name: "apercu_etape"; props: { etape: string } }
  | { name: "inscription_envoi"; props: { emplacement: string } }
  | { name: "inscription_succes"; props: { emplacement: string; statut: string } };

export function track(event: LandingEvent): void {
  vercelTrack(event.name, event.props);
}
