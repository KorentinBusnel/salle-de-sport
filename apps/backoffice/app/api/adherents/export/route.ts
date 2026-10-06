import { NextResponse } from "next/server";
import { z } from "zod";
import { getTeamContext, isManagerRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ ids: z.array(z.guid()).min(1).max(100) });

/** Cellule CSV (séparateur « ; » d'Excel en français) : guillemets si besoin. */
function cell(value: string | number | boolean | null): string {
  const text =
    value === null
      ? ""
      : typeof value === "boolean"
        ? value
          ? t("common.yes")
          : t("common.no")
        : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Export CSV des fiches choisies (gérant) : export_members inscrit chaque export au journal.
 * Pas d'envoi de message en masse depuis la liste (consentements).
 */
export async function POST(request: Request) {
  const result = await getTeamContext();
  if (result.status !== "team" || !isManagerRole(result.context.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("export_members", {
    p_gym_id: result.context.gym.id,
    p_member_ids: parsed.data.ids,
  });
  if (error) return NextResponse.json({ error: "unexpected" }, { status: 500 });

  const header = [
    t("members.export.lastName"),
    t("members.export.firstName"),
    t("members.export.email"),
    t("members.export.phone"),
    t("members.export.status"),
    t("members.export.tags"),
    t("members.export.credits"),
    t("members.export.emailConsent"),
    t("members.export.whatsappConsent"),
    t("members.export.createdAt"),
  ];
  const lines = data.map((row) =>
    [
      row.last_name,
      row.first_name,
      row.email,
      row.phone,
      t(`memberStatus.${row.status}`),
      row.tags.join(", "),
      row.credits,
      row.email_consent,
      row.whatsapp_consent,
      row.created_at.slice(0, 10),
    ]
      .map(cell)
      .join(";"),
  );
  // BOM : Excel reconnaît l'UTF-8 (accents).
  const csv = `﻿${[header.map(cell).join(";"), ...lines].join("\r\n")}\r\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="adherents.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
