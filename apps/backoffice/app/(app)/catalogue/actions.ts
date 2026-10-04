"use server";

import { capacitySchema, durationSchema } from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import type { TablesUpdate } from "@salle/supabase";
import type { CellValue } from "@/components/inline/editable-cell";
import { isManagerRole, requireRole } from "@/lib/auth";
import type { MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

type Result = { error: MessageKey | null };

const disciplineFields = {
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z
    .string()
    .trim()
    .max(300)
    .transform((v) => v || null),
  default_duration_minutes: durationSchema,
  default_capacity: capacitySchema,
  is_active: z.boolean(),
} as const;

const roomFields = {
  name: z.string().trim().min(1).max(60),
  capacity: capacitySchema,
} as const;

function failure(error: { code?: string } | null): Result {
  if (!error) return { error: null };
  return { error: error.code === "23505" ? "catalog.errors.duplicate" : "common.unexpectedError" };
}

function done(error: { code?: string } | null): Result {
  revalidatePath("/catalogue");
  revalidatePath("/planning", "layout");
  refresh();
  return failure(error);
}

export async function updateDiscipline(input: {
  id: string;
  field: string;
  value: CellValue;
}): Promise<Result> {
  const context = await requireRole(isManagerRole);
  const field = z
    .enum(Object.keys(disciplineFields) as [keyof typeof disciplineFields])
    .safeParse(input.field);
  if (!field.success || !z.guid().safeParse(input.id).success)
    return { error: "catalog.errors.invalid" };
  const value = disciplineFields[field.data].safeParse(input.value);
  if (!value.success) return { error: "catalog.errors.invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("disciplines")
    .update({ [field.data]: value.data } as TablesUpdate<"disciplines">)
    .eq("id", input.id)
    .eq("gym_id", context.gym.id);
  return done(error);
}

export async function updateRoom(input: {
  id: string;
  field: string;
  value: CellValue;
}): Promise<Result> {
  const context = await requireRole(isManagerRole);
  const field = z.enum(["name", "capacity"]).safeParse(input.field);
  if (!field.success || !z.guid().safeParse(input.id).success)
    return { error: "catalog.errors.invalid" };
  const value = roomFields[field.data].safeParse(input.value);
  if (!value.success) return { error: "catalog.errors.invalid" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ [field.data]: value.data } as TablesUpdate<"rooms">)
    .eq("id", input.id)
    .eq("gym_id", context.gym.id);
  return done(error);
}

/** Nom libre : « Nouvelle discipline », « Nouvelle discipline 2 »… */
async function freeName(table: "disciplines" | "rooms", gymId: string, base: string) {
  const supabase = await createClient();
  const { data } = await supabase.from(table).select("name").eq("gym_id", gymId);
  const taken = new Set((data ?? []).map((row) => row.name));
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base} ${n}`;
    if (!taken.has(name)) return name;
  }
}

export async function createDiscipline(): Promise<Result> {
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const { error } = await supabase.from("disciplines").insert({
    gym_id: context.gym.id,
    name: await freeName("disciplines", context.gym.id, "Nouvelle discipline"),
    color: "#475569",
  });
  return done(error);
}

export async function createRoom(): Promise<Result> {
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const { error } = await supabase.from("rooms").insert({
    gym_id: context.gym.id,
    name: await freeName("rooms", context.gym.id, "Nouvelle salle"),
    capacity: 12,
  });
  return done(error);
}
