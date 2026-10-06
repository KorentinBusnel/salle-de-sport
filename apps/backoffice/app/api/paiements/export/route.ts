import { formatMoney } from "@salle/shared";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTeamContext, isManagerRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

/** Cellule CSV (séparateur « ; » d'Excel en français) : guillemets si besoin. */
function cell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Export CSV des paiements d'une période (gérant) : export_payments l'inscrit au journal. */
export async function GET(request: NextRequest) {
  const result = await getTeamContext();
  if (result.status !== "team" || !isManagerRole(result.context.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const from = z.iso.date().safeParse(request.nextUrl.searchParams.get("du"));
  const to = z.iso.date().safeParse(request.nextUrl.searchParams.get("au"));
  if (!from.success || !to.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_payments", {
    p_gym_id: result.context.gym.id,
    p_from: from.data,
    p_to: to.data,
  });
  if (error) return NextResponse.json({ error: "unexpected" }, { status: 500 });
  // Date complète (comptabilité) : « 06/10/2026 13:35 ».
  const date = new Intl.DateTimeFormat("fr-FR", {
    timeZone: result.context.gym.timezone,
    dateStyle: "short",
    timeStyle: "short",
  });
  const header = [
    t("payments.date"),
    t("payments.member"),
    t("payments.what"),
    t("payments.promo"),
    t("payments.method"),
    t("payments.status"),
    t("payments.amount"),
  ];
  const lines = data.map((row) =>
    [
      date.format(new Date(row.paid_on)),
      row.member_name,
      row.plan_name ?? row.description,
      row.promo_code,
      t(`billing.methodLabel.${row.method}`),
      t(`billing.paymentStatus.${row.status}`),
      formatMoney(row.amount_cents, row.currency),
    ]
      .map(cell)
      .join(";"),
  );
  const body = `﻿${[header.map(cell).join(";"), ...lines].join("\r\n")}\r\n`;
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="paiements-${from.data}-${to.data}.csv"`,
      "cache-control": "no-store",
    },
  });
}
