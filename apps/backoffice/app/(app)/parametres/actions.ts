"use server";

import { gymSettingsSchema } from "@salle/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
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

export async function saveSettings(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const parsed = formSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(withFlash("/parametres", { error: "settings.invalid" }));

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
