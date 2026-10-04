"use server";

import { segmentFiltersSchema } from "@salle/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isManagerRole, requireRole } from "@/lib/auth";
import { withFlash } from "@/lib/flash";
import { filtersToSearch } from "@/lib/segments";
import { createClient } from "@/lib/supabase/server";

function parseJson(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(value ?? "{}"));
  } catch {
    return null;
  }
}

/** Enregistre les filtres en cours sous un nom (nouveau segment ou mise à jour). */
export async function saveSegment(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const name = z.string().trim().min(1).max(80).safeParse(formData.get("name"));
  const filters = segmentFiltersSchema.safeParse(parseJson(formData.get("filters")));
  const id = z
    .guid()
    .optional()
    .catch(undefined)
    .parse(formData.get("segmentId") || undefined);
  if (!name.success || !filters.success)
    redirect(withFlash("/segments", { error: "segments.errors.save" }));

  const supabase = await createClient();
  const row = { gym_id: context.gym.id, name: name.data, filters: filters.data };
  const { data, error } = id
    ? await supabase.from("segments").update(row).eq("id", id).select("id").single()
    : await supabase
        .from("segments")
        .insert({ ...row, created_by: context.userId })
        .select("id")
        .single();
  revalidatePath("/segments");
  if (error || !data) redirect(withFlash("/segments", { error: "common.unexpectedError" }));
  redirect(
    withFlash(`/segments?segment=${data.id}&${filtersToSearch(filters.data)}`, {
      ok: "segments.savedOk",
    }),
  );
}

export async function deleteSegment(formData: FormData) {
  await requireRole(isManagerRole);
  const id = z.guid().parse(formData.get("segmentId"));
  const supabase = await createClient();
  const { error } = await supabase.from("segments").delete().eq("id", id);
  revalidatePath("/segments");
  redirect(
    withFlash(
      "/segments",
      error ? { error: "common.unexpectedError" } : { ok: "segments.deletedOk" },
    ),
  );
}
