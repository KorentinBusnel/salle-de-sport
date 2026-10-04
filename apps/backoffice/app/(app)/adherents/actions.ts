"use server";

import { bookingErrorCode } from "@salle/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { NewMemberState } from "@/components/members/new-member-sheet";
import { isFrontDeskRole, isManagerRole, requireRole } from "@/lib/auth";
import { errorMessageKey, withFlash } from "@/lib/flash";
import type { MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

/** Revient sur la liste en conservant la recherche en cours. */
function back(formData: FormData) {
  const query = z.string().max(500).catch("").parse(formData.get("returnQuery"));
  return `/adherents${query ? `?${query}` : ""}`;
}

const STATUS_OK = {
  active: "members.activated",
  suspended: "members.suspended",
  cancelled: "members.cancelled",
} as const satisfies Record<string, MessageKey>;

/** Activer, suspendre, réactiver : set_member_status applique les stratégies de la salle. */
export async function setMemberStatus(formData: FormData) {
  await requireRole(isFrontDeskRole);
  const id = z.guid().parse(formData.get("memberId"));
  const status = z.enum(["active", "suspended", "cancelled"]).parse(formData.get("status"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_status", { p_member_id: id, p_status: status });
  revalidatePath("/adherents");
  redirect(
    withFlash(
      back(formData),
      error ? { error: errorMessageKey(error) } : { ok: STATUS_OK[status] },
    ),
  );
}

/** Ajout (ou retrait, si la stratégie l'autorise) de crédits par le gérant. */
export async function adjustCredits(formData: FormData) {
  await requireRole(isManagerRole);
  const id = z.guid().parse(formData.get("memberId"));
  const amount = z.coerce.number().int().min(1).max(50).safeParse(formData.get("amount"));
  if (!amount.success) redirect(withFlash(back(formData), { error: "members.creditsInvalid" }));
  const remove = formData.get("mode") === "remove";
  const note = z
    .string()
    .trim()
    .max(200)
    .catch("")
    .parse(formData.get("note") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_credits", {
    p_member_id: id,
    p_delta: remove ? -amount.data : amount.data,
    ...(note ? { p_note: note } : {}),
  });
  revalidatePath("/adherents");
  redirect(
    withFlash(
      back(formData),
      error
        ? { error: errorMessageKey(error) }
        : { ok: remove ? "members.creditsRemoved" : "members.creditsAdded" },
    ),
  );
}

const newMemberSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.union([z.literal(""), z.email().max(200)]),
  phone: z.string().trim().max(30),
  status: z.enum(["prospect", "active"]),
});

/** Nouvelle fiche : les doublons (email, téléphone) sont montrés avant confirmation. */
export async function createMember(
  _previous: NewMemberState,
  formData: FormData,
): Promise<NewMemberState> {
  const context = await requireRole(isFrontDeskRole);
  const values = {
    first_name: String(formData.get("first_name") ?? ""),
    last_name: String(formData.get("last_name") ?? ""),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? ""),
    status: formData.get("status") === "active" ? ("active" as const) : ("prospect" as const),
  };
  const force = formData.get("force") === "on";
  const parsed = newMemberSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: NewMemberState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "first_name" || field === "last_name")
        fieldErrors[field] = "members.new.errors.required";
      if (field === "email") fieldErrors.email = "members.new.errors.email";
    }
    return { values, fieldErrors, duplicates: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_member", {
    p_gym_id: context.gym.id,
    p_first_name: parsed.data.first_name,
    p_last_name: parsed.data.last_name,
    ...(parsed.data.email ? { p_email: parsed.data.email } : {}),
    ...(parsed.data.phone ? { p_phone: parsed.data.phone } : {}),
    p_status: parsed.data.status,
    p_force: force,
  });

  if (bookingErrorCode(error) === "duplicate_member") {
    const { data: duplicates } = await supabase.rpc("find_member_duplicates", {
      p_gym_id: context.gym.id,
      p_email: parsed.data.email,
      p_phone: parsed.data.phone,
    });
    return {
      values,
      fieldErrors: {},
      duplicates: (duplicates ?? []).map((m) => ({
        id: m.id,
        name: `${m.first_name} ${m.last_name}`,
        contact: [m.email, m.phone].filter(Boolean).join(" · "),
        status: m.status,
      })),
    };
  }
  if (error) return { values, fieldErrors: {}, duplicates: [], error: errorMessageKey(error) };

  revalidatePath("/adherents");
  redirect(
    withFlash(`/adherents?q=${encodeURIComponent(data.last_name)}`, { ok: "members.new.created" }),
  );
}
