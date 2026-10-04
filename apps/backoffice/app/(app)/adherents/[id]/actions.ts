"use server";

import { normalizeTags } from "@salle/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
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

const contactSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.union([z.literal(""), z.email().max(200)]),
  phone: z.string().trim().max(30),
  acquisition_source: z.string().trim().max(80),
});

export async function updateContact(formData: FormData) {
  const context = await requireRole(isFrontDeskRole);
  const { id, path } = target(formData);
  const parsed = contactSchema.safeParse({
    first_name: String(formData.get("first_name") ?? ""),
    last_name: String(formData.get("last_name") ?? ""),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? ""),
    acquisition_source: String(formData.get("acquisition_source") ?? ""),
  });
  if (!parsed.success) redirect(withFlash(path, { error: "memberProfile.errors.contact" }));
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      email: parsed.data.email.toLowerCase() || null,
      phone: parsed.data.phone || null,
      acquisition_source: parsed.data.acquisition_source || null,
    })
    .eq("id", id)
    .eq("gym_id", context.gym.id);
  done(path, error, "common.saved");
}

async function writeTags(gymId: string, id: string, change: (tags: string[]) => string[]) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("tags")
    .eq("id", id)
    .eq("gym_id", gymId)
    .single();
  return supabase
    .from("members")
    .update({ tags: normalizeTags(change(data?.tags ?? [])).slice(0, 20) })
    .eq("id", id)
    .eq("gym_id", gymId);
}

export async function addTag(formData: FormData) {
  const context = await requireRole(isFrontDeskRole);
  const { id, path } = target(formData);
  const tag = z.string().trim().min(1).max(40).safeParse(formData.get("tag"));
  if (!tag.success) redirect(withFlash(path, { error: "memberProfile.errors.tag" }));
  const { error } = await writeTags(context.gym.id, id, (tags) => [...tags, tag.data]);
  done(path, error, "memberProfile.tagAdded");
}

export async function removeTag(formData: FormData) {
  const context = await requireRole(isFrontDeskRole);
  const { id, path } = target(formData);
  const tag = z.string().parse(formData.get("tag"));
  const { error } = await writeTags(context.gym.id, id, (tags) => tags.filter((t) => t !== tag));
  done(path, error, "memberProfile.tagRemoved");
}

/** Consentements marketing (RGPD) : date d'accord, ou retrait. */
export async function setConsent(formData: FormData) {
  const context = await requireRole(isFrontDeskRole);
  const { id, path } = target(formData);
  const channel = z.enum(["email", "whatsapp"]).parse(formData.get("channel"));
  const granted = formData.get("granted") === "true";
  const value = granted ? new Date().toISOString() : null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update(
      channel === "email"
        ? { marketing_email_consent_at: value }
        : { marketing_whatsapp_consent_at: value },
    )
    .eq("id", id)
    .eq("gym_id", context.gym.id);
  done(path, error, granted ? "memberProfile.consentGranted" : "memberProfile.consentWithdrawn");
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
