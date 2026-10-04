"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isManagerRole, requireRole } from "@/lib/auth";
import { errorMessageKey, withFlash } from "@/lib/flash";
import { createClient } from "@/lib/supabase/server";

const PATH = "/planning/modeles";
const optionalUuid = z.preprocess((v) => (v === "" ? null : v), z.guid().nullable());
const optionalDate = z.preprocess((v) => (v === "" ? null : v), z.iso.date().nullable());

const templateSchema = z
  .object({
    discipline_id: z.guid(),
    default_coach_id: optionalUuid,
    room_id: optionalUuid,
    weekday: z.coerce.number().int().min(1).max(7),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    duration_minutes: z.coerce.number().int().min(15).max(240),
    capacity: z.coerce.number().int().min(1).max(200),
    starts_on: z.iso.date(),
    ends_on: optionalDate,
  })
  .refine((v) => !v.ends_on || v.ends_on >= v.starts_on);

export async function createTemplate(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const parsed = templateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(withFlash(PATH, { error: "templates.invalid" }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("class_templates")
    .insert({ ...parsed.data, gym_id: context.gym.id });
  revalidatePath(PATH);
  redirect(
    withFlash(PATH, error ? { error: "common.unexpectedError" } : { ok: "templates.created" }),
  );
}

export async function toggleTemplate(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const id = z.guid().parse(formData.get("id"));
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  const { error } = await supabase
    .from("class_templates")
    .update({ is_active: active })
    .eq("id", id)
    .eq("gym_id", context.gym.id);
  revalidatePath(PATH);
  redirect(
    withFlash(PATH, error ? { error: "common.unexpectedError" } : { ok: "templates.updated" }),
  );
}

export async function generateSessions(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const period = z
    .object({ from: z.iso.date(), to: z.iso.date() })
    .safeParse({ from: formData.get("from"), to: formData.get("to") });
  if (!period.success) redirect(withFlash(PATH, { error: "bookingErrors.invalid_period" }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_sessions", {
    p_gym_id: context.gym.id,
    p_from: period.data.from,
    p_to: period.data.to,
  });
  revalidatePath(PATH);
  revalidatePath("/planning");
  if (error) redirect(withFlash(PATH, { error: errorMessageKey(error) }));
  redirect(`${PATH}?genere=${data ?? 0}`);
}
