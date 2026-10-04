"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isFrontDeskRole, isManagerRole, requireRole } from "@/lib/auth";
import { withFlash } from "@/lib/flash";
import { createClient } from "@/lib/supabase/server";

/** Revient sur la liste en conservant la recherche en cours. */
function back(formData: FormData) {
  const query = z.string().max(500).catch("").parse(formData.get("returnQuery"));
  return `/adherents${query ? `?${query}` : ""}`;
}

export async function activateMember(formData: FormData) {
  const context = await requireRole(isFrontDeskRole);
  const id = z.guid().parse(formData.get("memberId"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({ status: "active" })
    .eq("id", id)
    .eq("gym_id", context.gym.id)
    .in("status", ["prospect", "suspended"]);
  revalidatePath("/adherents");
  redirect(
    withFlash(
      back(formData),
      error ? { error: "common.unexpectedError" } : { ok: "members.activated" },
    ),
  );
}

export async function addCredits(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const id = z.guid().parse(formData.get("memberId"));
  const amount = z.coerce.number().int().min(1).max(50).safeParse(formData.get("amount"));
  if (!amount.success) redirect(withFlash(back(formData), { error: "members.creditsInvalid" }));

  const note = z
    .string()
    .trim()
    .max(200)
    .catch("")
    .parse(formData.get("note") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("credit_ledger").insert({
    gym_id: context.gym.id,
    member_id: id,
    delta: amount.data,
    reason: "manual_adjustment",
    note: note || "Ajout manuel (back office)",
    created_by: context.userId,
  });
  revalidatePath("/adherents");
  redirect(
    withFlash(
      back(formData),
      error ? { error: "common.unexpectedError" } : { ok: "members.creditsAdded" },
    ),
  );
}
