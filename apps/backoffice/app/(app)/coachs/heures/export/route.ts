import { zonedDateKey } from "@salle/shared";
import type { NextRequest } from "next/server";
import { getTeamContext, isManagerRole } from "@/lib/auth";
import { csvField, loadCoachHours } from "@/lib/coach-hours";
import { currentMonthKey } from "@/lib/coaches";
import { gymFormatters } from "@/lib/format";

/**
 * Export CSV des heures réalisées (base des factures freelances) : synthèse de tous les
 * coachs, ou détail des séances d'un coach (`?coach=`). Un coach n'exporte que les siennes.
 */
export async function GET(request: NextRequest) {
  const result = await getTeamContext();
  if (result.status !== "team") return new Response(null, { status: 401 });
  const { context } = result;
  const manager = isManagerRole(context.role);
  const params = request.nextUrl.searchParams;
  const month = params.get("mois") ?? currentMonthKey(context);
  const coachParam = manager ? (params.get("coach") ?? undefined) : undefined;
  const data = await loadCoachHours(context, month, coachParam);
  if (!data) return new Response(null, { status: 400 });

  const amount = (cents: number | null) =>
    cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");
  const hours = (minutes: number) => (minutes / 60).toFixed(2).replace(".", ",");
  const format = gymFormatters(context.gym.timezone);
  let lines: (string | number)[][];
  let name: string;

  if (data.line && (coachParam || !manager)) {
    const line = data.line;
    const rate = line.hourly_rate_cents;
    lines = [
      ["Coach", "Date", "Début", "Fin", "Discipline", "Heures", "Taux horaire (€)", "Montant (€)"],
      ...data.sessions.map((s) => [
        line.display_name,
        zonedDateKey(new Date(s.starts_at), context.gym.timezone),
        format.time(s.starts_at),
        format.time(s.ends_at),
        s.discipline,
        hours(s.minutes),
        amount(rate),
        amount(rate === null ? null : Math.round((s.minutes * rate) / 60)),
      ]),
      ["Total", "", "", "", "", hours(line.minutes), amount(rate), amount(line.amount_cents)],
    ];
    const slug = line.display_name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    name = `heures-${slug}-${month}.csv`;
  } else if (manager) {
    lines = [
      ["Coach", "Séances", "Heures", "Taux horaire (€)", "Montant (€)"],
      ...data.summary.map((r) => [
        r.display_name,
        r.sessions,
        hours(r.minutes),
        amount(r.hourly_rate_cents),
        amount(r.amount_cents),
      ]),
    ];
    name = `heures-coachs-${month}.csv`;
  } else {
    return new Response(null, { status: 403 });
  }

  // BOM : Excel ouvre le fichier en UTF-8 (accents).
  const body = `﻿${lines.map((l) => l.map(csvField).join(";")).join("\r\n")}\r\n`;
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
