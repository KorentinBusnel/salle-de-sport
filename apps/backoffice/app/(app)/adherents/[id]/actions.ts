"use server";

import { normalizeTags } from "@salle/shared";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { CellValue } from "@/components/inline/editable-cell";
import { type ActionResult, fail, ok } from "@/lib/action-result";
import { isFrontDeskRole, isManagerRole, requireRole } from "@/lib/auth";
import { errorMessageKey, withFlash } from "@/lib/flash";
import type { MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

function target(formData: FormData) {
  const id = z.guid().parse(formData.get("memberId"));
  const tab = z
    .enum(["historique", "reservations", "profil"])
    .catch("profil")
    .parse(formData.get("tab"));
  return { id, path: `/adherents/${id}?onglet=${tab}` };
}

function done(path: string, error: { message?: string } | null, ok: MessageKey): never {
  revalidatePath("/adherents", "layout");
  redirect(withFlash(path, error ? { error: errorMessageKey(error) } : { ok }));
}

/** Note interne dans l'historique (gérant : le CRM lui est réservé). */
export async function addNote(formData: FormData) {
  const context = await requireRole(isManagerRole);
  const { id, path } = target(formData);
  const text = z.string().trim().min(1).max(2000).safeParse(formData.get("note"));
  if (!text.success) redirect(withFlash(path, { error: "memberProfile.errors.note" }));
  const supabase = await createClient();
  const { error } = await supabase.from("interactions").insert({
    gym_id: context.gym.id,
    member_id: id,
    channel: "note",
    direction: "internal",
    summary: text.data,
    created_by: context.userId,
  });
  done(path, error, "memberProfile.noteAdded");
}

/** Inscription à une séance depuis la fiche (book_session : mêmes règles que partout). */
export async function bookFromProfile(formData: FormData) {
  await requireRole(isFrontDeskRole);
  const { id, path } = target(formData);
  const sessionId = z.guid().safeParse(formData.get("sessionId"));
  if (!sessionId.success) redirect(withFlash(path, { error: "memberProfile.errors.session" }));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_session", {
    p_session_id: sessionId.data,
    p_member_id: id,
  });
  done(path, error, data?.status === "waitlisted" ? "session.addedToWaitlist" : "session.booked");
}

const careNoteSchema = z.string().trim().max(500);

async function writeCareNote(gymId: string, memberId: string, note: string) {
  const supabase = await createClient();
  const { error } = note
    ? await supabase.from("member_care_notes").upsert({ member_id: memberId, gym_id: gymId, note })
    : await supabase
        .from("member_care_notes")
        .delete()
        .eq("member_id", memberId)
        .eq("gym_id", gymId);
  return error;
}

/** Note « à savoir » (santé, blessure…) : accueil et gérant ; vide = supprimée. */
export async function saveCareNote(formData: FormData) {
  const context = await requireRole(isFrontDeskRole);
  const { id, path } = target(formData);
  const note = careNoteSchema.safeParse(formData.get("careNote") ?? "");
  if (!note.success) redirect(withFlash(path, { error: "memberProfile.careNoteTooLong" }));
  const error = await writeCareNote(context.gym.id, id, note.data);
  done(path, error, note.data ? "memberProfile.careNoteSaved" : "memberProfile.careNoteCleared");
}

/** Même note, modifiée sur place (accueil du jour) : pas de redirection. */
export async function updateCareNote(input: {
  memberId: string;
  note: string;
}): Promise<ActionResult> {
  const context = await requireRole(isFrontDeskRole);
  const memberId = z.guid().safeParse(input.memberId);
  if (!memberId.success) return fail("common.unexpectedError");
  const note = careNoteSchema.safeParse(input.note);
  if (!note.success) return fail("memberProfile.careNoteTooLong");
  const error = await writeCareNote(context.gym.id, memberId.data, note.data);
  if (error) return fail(errorMessageKey(error));
  refresh();
  return ok(note.data ? "memberProfile.careNoteSaved" : "memberProfile.careNoteCleared");
}

const FIELD_SCHEMAS = {
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.union([z.literal(""), z.email().max(200)]),
  phone: z.string().trim().max(30),
  acquisition_source: z.string().trim().max(80),
} as const;

/** Coordonnée modifiée sur place (EditableCell) : une colonne autorisée à la fois. */
export async function updateMemberField(input: {
  id: string;
  field: string;
  value: CellValue;
}): Promise<{ error: MessageKey | null; message?: MessageKey }> {
  const context = await requireRole(isFrontDeskRole);
  const id = z.guid().safeParse(input.id);
  const field = z
    .enum(["first_name", "last_name", "email", "phone", "acquisition_source"])
    .safeParse(input.field);
  if (!id.success || !field.success) return { error: "common.unexpectedError" };
  const value = FIELD_SCHEMAS[field.data].safeParse(
    typeof input.value === "string" ? input.value.trim() : input.value,
  );
  if (!value.success) return { error: `memberProfile.errors.${field.data}` };
  const text = field.data === "email" ? value.data.toLowerCase() : value.data;
  // Nom et prénom obligatoires ; les autres coordonnées vides sont effacées.
  const changes =
    field.data === "first_name"
      ? { first_name: text }
      : field.data === "last_name"
        ? { last_name: text }
        : field.data === "email"
          ? { email: text || null }
          : field.data === "phone"
            ? { phone: text || null }
            : { acquisition_source: text || null };
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update(changes)
    .eq("id", id.data)
    .eq("gym_id", context.gym.id);
  refresh();
  return error ? { error: errorMessageKey(error) } : { error: null, message: "common.saved" };
}

/** Étiquettes de la fiche, enregistrées à chaque modification (« Annuler » côté client). */
export async function setMemberTags(input: {
  memberId: string;
  tags: string[];
}): Promise<ActionResult> {
  const context = await requireRole(isFrontDeskRole);
  const id = z.guid().safeParse(input.memberId);
  const tags = z.array(z.string().trim().min(1).max(40)).max(20).safeParse(input.tags);
  if (!id.success || !tags.success) return fail("memberProfile.errors.tag");
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({ tags: normalizeTags(tags.data).slice(0, 20) })
    .eq("id", id.data)
    .eq("gym_id", context.gym.id);
  refresh();
  return error ? fail(errorMessageKey(error)) : ok();
}

const consentSchema = z.object({
  memberId: z.guid(),
  channel: z.enum(["email", "whatsapp"]),
  granted: z.boolean(),
});

/**
 * Consentement marketing (RGPD) : date d'accord (maintenant) ou retrait. Chaque changement est
 * inscrit au journal par la base (trigger).
 */
export async function setConsentQuick(input: z.input<typeof consentSchema>): Promise<ActionResult> {
  const context = await requireRole(isFrontDeskRole);
  const parsed = consentSchema.safeParse(input);
  if (!parsed.success) return fail("common.unexpectedError");
  const value = parsed.data.granted ? new Date().toISOString() : null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update(
      parsed.data.channel === "email"
        ? { marketing_email_consent_at: value }
        : { marketing_whatsapp_consent_at: value },
    )
    .eq("id", parsed.data.memberId)
    .eq("gym_id", context.gym.id);
  refresh();
  return error ? fail(errorMessageKey(error)) : ok();
}
