import { formatMoney } from "@salle/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getTeamContext, isManagerRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { buildReceipt, receiptNumber } from "@/lib/receipt";
import { createClient } from "@/lib/supabase/server";

/** Reçu PDF d'un paiement encaissé (gérant : les finances lui sont réservées, RLS comprise). */
export async function GET(_request: Request, context: RouteContext<"/api/paiements/[id]/recu">) {
  const result = await getTeamContext();
  if (result.status !== "team" || !isManagerRole(result.context.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const id = z.guid().safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const supabase = await createClient();
  const [{ data: payment }, { data: gym }] = await Promise.all([
    supabase
      .from("payments")
      .select(
        "id, amount_cents, currency, status, method, description, paid_at, created_at, members(first_name, last_name, email), plans(name), promo_codes(code)",
      )
      .eq("id", id.data)
      .eq("gym_id", result.context.gym.id)
      .maybeSingle(),
    supabase
      .from("gyms")
      .select("name, address, email, phone")
      .eq("id", result.context.gym.id)
      .single(),
  ]);
  if (!payment || !gym) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Seul un paiement encaissé (ou encaissé puis remboursé) donne un reçu.
  if (payment.status !== "succeeded" && payment.status !== "refunded") {
    return NextResponse.json({ error: "not_paid" }, { status: 409 });
  }

  const paidAt = payment.paid_at ?? payment.created_at;
  const timeZone = result.context.gym.timezone;
  const bytes = await buildReceipt({
    paymentId: payment.id,
    paidAt,
    timeZone,
    gym,
    member: {
      name: payment.members ? `${payment.members.first_name} ${payment.members.last_name}` : "—",
      email: payment.members?.email ?? null,
    },
    label: payment.plans?.name ?? payment.description ?? t("receipt.payment"),
    promoCode: payment.promo_codes?.code ?? null,
    method: t(`billing.methodLabel.${payment.method}`),
    amount: formatMoney(payment.amount_cents, payment.currency),
    refunded: payment.status === "refunded",
  });
  const file = `recu-${receiptNumber(payment.id, paidAt, timeZone)}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "private, no-store",
    },
  });
}
