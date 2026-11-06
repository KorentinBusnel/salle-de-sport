import type { SessionPhase } from "@salle/shared";

/** Une heure avant le début d'une séance, l'accueil se remet à relire toutes les minutes. */
export const LIVE_LEAD_MS = 60 * 60_000;

export type LiveWindow = {
  /** Fin de la dernière séance en cours ou imminente : la relecture par intervalle s'arrête là. */
  pollUntil: string | null;
  /** Une heure avant la séance suivante, hors de cette fenêtre : la relecture reprend. */
  resumeAt: string | null;
};

/**
 * Fenêtre pendant laquelle l'accueil vaut la peine d'être relu toutes les minutes : une séance en
 * cours, ou qui commence dans l'heure. Salle fermée, rien ne bouge : pas de relecture (seuls le
 * Realtime et le retour sur l'onglet rafraîchissent).
 */
export function liveWindow(
  sessions: readonly { starts_at: string; ends_at: string; phase: SessionPhase }[],
  now: Date,
): LiveWindow {
  const soon = now.getTime() + LIVE_LEAD_MS;
  let pollUntil: number | null = null;
  let nextStart: number | null = null;
  for (const session of sessions) {
    const starts = Date.parse(session.starts_at);
    const ends = Date.parse(session.ends_at);
    if (session.phase === "live" || (session.phase === "upcoming" && starts <= soon)) {
      pollUntil = pollUntil === null ? ends : Math.max(pollUntil, ends);
    } else if (session.phase === "upcoming") {
      nextStart = nextStart === null ? starts : Math.min(nextStart, starts);
    }
  }
  return {
    pollUntil: pollUntil === null ? null : new Date(pollUntil).toISOString(),
    resumeAt: nextStart === null ? null : new Date(nextStart - LIVE_LEAD_MS).toISOString(),
  };
}
