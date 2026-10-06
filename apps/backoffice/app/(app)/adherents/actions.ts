"use server";

import { bookingErrorCode } from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { NewMemberState } from "@/components/members/new-member-sheet";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { isFrontDeskRole, isManagerRole, requireRole } from "@/lib/auth";
import { errorMessageKey, withFlash } from "@/lib/flash";
import type { MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getGymConfig } from "@/lib/settings";

/** Revient sur la fiche (returnTo) ou sur la liste en conservant la recherche en cours. */
function back(formData: FormData) {
  const returnTo = z
    .string()
    .regex(/^(\/adherents\/[0-9a-f-]{36}(\?[\w=&%-]*)?|\/crm)$/)
    .safeParse(formData.get("returnTo"));
  if (returnTo.success) return returnTo.data;
  const query = z.string().max(500).catch("").parse(formData.get("returnQuery"));
  return `/adherents${query ? `?${query}` : ""}`;
}

const STATUS_OK = {
  active: "members.activated",
  suspended: "members.suspended",
  cancelled: "members.cancelled",
} as const satisfies Record<string, MessageKey>;

/** Ajout (ou retrait, si la stratégie l'autorise) de crédits par le gérant. */
export async function adjustCredits(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const id = z.guid().parse(formData.get("memberId"));
  const { credit_adjust_max: max } = (await getGymConfig(context.gym.id)).private;
  const amount = z.coerce.number().int().min(1).max(max).safeParse(formData.get("amount"));
  if (!amount.success)
    redirect(withFlash(back(formData), { error: "members.creditsInvalid", count: max }));
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
  revalidatePath("/adherents", "layout");
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

const statusSchema = z.object({
  memberId: z.guid(),
  status: z.enum(["active", "suspended", "cancelled"]),
});

/** Statut changé depuis la liste (menu de ligne) : toast et « Annuler », pas de redirection. */
export async function setMemberStatusQuick(
  input: z.input<typeof statusSchema>,
): Promise<ActionResult> {
  await requireRole(isFrontDeskRole);
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_status", {
    p_member_id: parsed.data.memberId,
    p_status: parsed.data.status,
  });
  refresh();
  return error ? fail(errorMessageKey(error)) : ok(STATUS_OK[parsed.data.status]);
}

const idsSchema = z.array(z.guid()).min(1).max(100);

/** Activer plusieurs inscriptions (set_member_status pour chacune ; stratégies appliquées). */
export async function bulkActivate(input: { memberIds: string[] }): Promise<ActionResult> {
  await requireRole(isFrontDeskRole);
  const ids = idsSchema.safeParse(input.memberIds);
  if (!ids.success) return fail("common.unexpectedError");
  const supabase = await createClient();
  let done = 0;
  let failed: { message?: string } | null = null;
  for (const id of ids.data) {
    const { error } = await supabase.rpc("set_member_status", {
      p_member_id: id,
      p_status: "active",
    });
    if (error) failed = error;
    else done += 1;
  }
  refresh();
  if (failed && done === 0) return fail(errorMessageKey(failed));
  return ok("members.bulk.activated", done);
}

/** Ajouter une étiquette à plusieurs fiches (add_member_tag). */
export async function bulkAddTag(input: {
  memberIds: string[];
  tag: string;
}): Promise<ActionResult> {
  const context = await requireRole(isFrontDeskRole);
  const ids = idsSchema.safeParse(input.memberIds);
  const tag = z.string().trim().min(1).max(40).safeParse(input.tag);
  if (!ids.success || !tag.success) return fail("members.bulk.tagInvalid");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_member_tag", {
    p_gym_id: context.gym.id,
    p_member_ids: ids.data,
    p_tag: tag.data,
  });
  refresh();
  return error ? fail(errorMessageKey(error)) : ok("members.bulk.tagged", data ?? 0);
}
