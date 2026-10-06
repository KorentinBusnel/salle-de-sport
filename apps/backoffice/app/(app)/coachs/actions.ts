"use server";

import { openingHoursSchema, WEEKDAY_KEYS } from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionResult, fail, ok } from "@/lib/action-result";
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

/**
 * Disponibilités de la semaine (éditeur hebdomadaire, enregistrement sur place) : seules les
 * plages permanentes (sans date de fin) sont remplacées, par différence avec l'existant.
 */
export async function saveAvailability(coachId: string, week: unknown): Promise<ActionResult> {
  const id = z.guid().safeParse(coachId);
  if (!id.success) return fail("common.unexpectedError");
  const context = await requireCoachEditor(id.data);
  const parsed = openingHoursSchema.safeParse(week);
  if (!parsed.success) return fail("coaches.errors.availability");

  const wanted = new Set(
    WEEKDAY_KEYS.flatMap((day) =>
      (parsed.data[day] ?? []).map((slot) => `${day}|${slot.start}|${slot.end}`),
    ),
  );
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("coach_availabilities")
    .select("id, weekday, start_time, end_time")
    .eq("coach_id", id.data)
    .is("valid_until", null);
  if (readError) return fail("common.unexpectedError");
  const key = (row: { weekday: number; start_time: string; end_time: string }) =>
    `${row.weekday}|${row.start_time.slice(0, 5)}|${row.end_time.slice(0, 5)}`;
  const existing = new Set((current ?? []).map(key));
  const removed = (current ?? []).filter((row) => !wanted.has(key(row))).map((row) => row.id);
  const added = [...wanted]
    .filter((k) => !existing.has(k))
    .map((k) => {
      const [weekday = "1", start_time = "", end_time = ""] = k.split("|");
      return {
        gym_id: context.gym.id,
        coach_id: id.data,
        weekday: Number(weekday),
        start_time,
        end_time,
      };
    });

  if (added.length) {
    const { error } = await supabase.from("coach_availabilities").insert(added);
    if (error) return fail(errorMessageKey(error));
  }
  if (removed.length) {
    const { error } = await supabase
      .from("coach_availabilities")
      .delete()
      .in("id", removed)
      .eq("coach_id", id.data);
    if (error) return fail(errorMessageKey(error));
  }
  refresh();
  return ok("coaches.availabilitySaved");
}
