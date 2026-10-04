"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isManagerRole, requireRole, requireTeamContext } from "@/lib/auth";
import { getOwnCoachId } from "@/lib/coaches";
import { errorMessageKey, withFlash } from "@/lib/flash";
import { createClient } from "@/lib/supabase/server";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

/** Taux horaire saisi en euros (« 32,50 ») → centimes ; vide : non renseigné. */
const rateCents = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const value = Number(v.replace(",", "."));
    if (!Number.isFinite(value) || value < 0 || value > 1000) {
      ctx.addIssue({ code: "custom", message: "rate" });
      return z.NEVER;
    }
    return Math.round(value * 100);
  });

const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(80),
  bio: optionalText(500),
  photo_url: z.union([z.literal(""), z.url({ protocol: /^https$/ }).max(500)]),
  hourly_rate: rateCents,
});

function profileFrom(formData: FormData) {
  return profileSchema.safeParse({
    display_name: String(formData.get("display_name") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    photo_url: String(formData.get("photo_url") ?? "").trim(),
    hourly_rate: String(formData.get("hourly_rate") ?? ""),
  });
}

/** Nouveau coach (freelance) : fiche et taux horaire. */
export async function createCoach(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const parsed = profileFrom(formData);
  if (!parsed.success) redirect(withFlash("/coachs", { error: "coaches.errors.profile" }));

  const supabase = await createClient();
  const { data: coach, error } = await supabase
    .from("coaches")
    .insert({
      gym_id: context.gym.id,
      display_name: parsed.data.display_name,
      bio: parsed.data.bio,
      photo_url: parsed.data.photo_url || null,
    })
    .select("id")
    .single();
  if (error || !coach) redirect(withFlash("/coachs", { error: "common.unexpectedError" }));

  await supabase.from("coach_compensations").insert({
    coach_id: coach.id,
    gym_id: context.gym.id,
    employment_type: "freelance",
    hourly_rate_cents: parsed.data.hourly_rate,
  });
  revalidatePath("/coachs");
  redirect(withFlash(`/coachs/${coach.id}`, { ok: "coaches.created" }));
}

/** Profil, disciplines, taux horaire et statut (gérant). */
export async function updateCoach(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const id = z.guid().parse(formData.get("coachId"));
  const back = `/coachs/${id}`;
  const parsed = profileFrom(formData);
  if (!parsed.success) redirect(withFlash(back, { error: "coaches.errors.profile" }));
  const disciplineIds = z.array(z.guid()).parse(formData.getAll("disciplines"));
  const active = formData.get("is_active") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("coaches")
    .update({
      display_name: parsed.data.display_name,
      bio: parsed.data.bio,
      photo_url: parsed.data.photo_url || null,
      is_active: active,
    })
    .eq("id", id)
    .eq("gym_id", context.gym.id);
  if (error) redirect(withFlash(back, { error: "common.unexpectedError" }));

  await supabase.from("coach_compensations").upsert({
    coach_id: id,
    gym_id: context.gym.id,
    employment_type: "freelance",
    hourly_rate_cents: parsed.data.hourly_rate,
  });

  // Disciplines : on remplace l'ensemble par la sélection.
  await supabase.from("coach_disciplines").delete().eq("coach_id", id);
  if (disciplineIds.length) {
    await supabase.from("coach_disciplines").insert(
      disciplineIds.map((discipline_id) => ({
        gym_id: context.gym.id,
        coach_id: id,
        discipline_id,
      })),
    );
  }
  revalidatePath("/coachs");
  revalidatePath(back);
  redirect(withFlash(back, { ok: "common.saved" }));
}

/** Le gérant, ou le coach pour lui-même (la RLS tranche aussi). */
async function requireCoachEditor(coachId: string) {
  const context = await requireTeamContext();
  if (isManagerRole(context.role)) return context;
  if ((await getOwnCoachId(context.userId, context.gym.id)) === coachId) return context;
  redirect("/?erreur=errors.forbiddenRole");
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const availabilitySchema = z
  .object({
    weekday: z.coerce.number().int().min(1).max(7),
    start_time: time,
    end_time: time,
  })
  .refine((v) => v.end_time > v.start_time);

export async function addAvailability(formData: FormData) {
  const coachId = z.guid().parse(formData.get("coachId"));
  const context = await requireCoachEditor(coachId);
  const back = `/coachs/${coachId}`;
  const parsed = availabilitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(withFlash(back, { error: "coaches.errors.availability" }));

  const supabase = await createClient();
  const { error } = await supabase.from("coach_availabilities").insert({
    gym_id: context.gym.id,
    coach_id: coachId,
    ...parsed.data,
  });
  revalidatePath(back);
  redirect(
    withFlash(
      back,
      error ? { error: errorMessageKey(error) } : { ok: "coaches.availabilityAdded" },
    ),
  );
}

export async function removeAvailability(formData: FormData) {
  const coachId = z.guid().parse(formData.get("coachId"));
  await requireCoachEditor(coachId);
  const id = z.guid().parse(formData.get("availabilityId"));
  const back = `/coachs/${coachId}`;
  const supabase = await createClient();
  const { error } = await supabase
    .from("coach_availabilities")
    .delete()
    .eq("id", id)
    .eq("coach_id", coachId);
  revalidatePath(back);
  redirect(
    withFlash(
      back,
      error ? { error: errorMessageKey(error) } : { ok: "coaches.availabilityRemoved" },
    ),
  );
}
