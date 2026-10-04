"use server";

import { gymSettingsSchema } from "@salle/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { SettingsState } from "@/components/settings/settings-form";
import type { StrategiesState } from "@/components/settings/strategies-form";
import { isManagerRole, requireRole } from "@/lib/auth";
import { withFlash } from "@/lib/flash";
import { createClient } from "@/lib/supabase/server";

const formSchema = z.object({
  max_upcoming_bookings: z.coerce
    .number()
    .pipe(gymSettingsSchema.shape.max_upcoming_bookings.unwrap()),
  cancellation_recommended_hours: z.coerce
    .number()
    .pipe(gymSettingsSchema.shape.cancellation_recommended_hours.unwrap()),
});

export async function saveSettings(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const context = await requireRole(isManagerRole);
  const values = {
    max_upcoming_bookings: String(formData.get("max_upcoming_bookings") ?? ""),
    cancellation_recommended_hours: String(formData.get("cancellation_recommended_hours") ?? ""),
  };
  const parsed = formSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: SettingsState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "max_upcoming_bookings")
        fieldErrors.max_upcoming_bookings = "settings.errors.maxUpcoming";
      if (issue.path[0] === "cancellation_recommended_hours")
        fieldErrors.cancellation_recommended_hours = "settings.errors.recommendedHours";
    }
    return { values, fieldErrors };
  }

  return mergeSettings(context.gym.id, parsed.data);
}

/** Fusionne des réglages dans gyms.settings puis revient sur la page avec le résultat. */
async function mergeSettings(
  gymId: string,
  patch: Record<string, number | boolean | null>,
): Promise<never> {
  const supabase = await createClient();
  const { data: gym } = await supabase.from("gyms").select("settings").eq("id", gymId).single();
  const current =
    gym?.settings && typeof gym.settings === "object" && !Array.isArray(gym.settings)
      ? gym.settings
      : {};
  const { error } = await supabase
    .from("gyms")
    .update({ settings: { ...current, ...patch } })
    .eq("id", gymId);
  revalidatePath("/", "layout");
  redirect(
    withFlash("/parametres", error ? { error: "common.unexpectedError" } : { ok: "common.saved" }),
  );
}

const shape = gymSettingsSchema.shape;
const strategiesSchema = z.object({
  late_booking_minutes: z.coerce.number().pipe(shape.late_booking_minutes.unwrap()),
  attendance_opens_minutes_before: z
    .string()
    .transform((value) => (value.trim() === "" ? null : Number(value)))
    .pipe(shape.attendance_opens_minutes_before.unwrap()),
});

export async function saveStrategies(
  _previous: StrategiesState,
  formData: FormData,
): Promise<StrategiesState> {
  const context = await requireRole(isManagerRole);
  const values: StrategiesState["values"] = {
    late_booking_minutes: String(formData.get("late_booking_minutes") ?? "").trim() || "0",
    attendance_opens_minutes_before: String(
      formData.get("attendance_opens_minutes_before") ?? "",
    ).trim(),
    allow_attendance_reset: formData.get("allow_attendance_reset") === "on",
    manager_can_remove_credits: formData.get("manager_can_remove_credits") === "on",
    staff_can_suspend_members: formData.get("staff_can_suspend_members") === "on",
    staff_can_create_members: formData.get("staff_can_create_members") === "on",
  };
  const parsed = strategiesSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: StrategiesState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "late_booking_minutes")
        fieldErrors.late_booking_minutes = "strategies.errors.lateBooking";
      if (issue.path[0] === "attendance_opens_minutes_before")
        fieldErrors.attendance_opens_minutes_before = "strategies.errors.attendanceOpens";
    }
    return { values, fieldErrors };
  }

  return mergeSettings(context.gym.id, {
    ...parsed.data,
    allow_attendance_reset: values.allow_attendance_reset,
    manager_can_remove_credits: values.manager_can_remove_credits,
    staff_can_suspend_members: values.staff_can_suspend_members,
    staff_can_create_members: values.staff_can_create_members,
  });
}
