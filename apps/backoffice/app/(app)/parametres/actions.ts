"use server";

import { gymSettingsSchema } from "@salle/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { SettingsState } from "@/components/settings/settings-form";
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

  const supabase = await createClient();
  const { data: gym } = await supabase
    .from("gyms")
    .select("settings")
    .eq("id", context.gym.id)
    .single();
  const current =
    gym?.settings && typeof gym.settings === "object" && !Array.isArray(gym.settings)
      ? gym.settings
      : {};
  const { error } = await supabase
    .from("gyms")
    .update({ settings: { ...current, ...parsed.data } })
    .eq("id", context.gym.id);
  revalidatePath("/parametres");
  redirect(
    withFlash("/parametres", error ? { error: "common.unexpectedError" } : { ok: "common.saved" }),
  );
}
