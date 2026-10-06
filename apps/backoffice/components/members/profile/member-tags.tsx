"use client";

import { setMemberTags } from "@/app/(app)/adherents/[id]/actions";
import { TagInput } from "@/components/forms/tag-input";
import { useAutosave } from "@/components/settings/setting-rows";
import { t } from "@/lib/i18n";

/** Étiquettes de la fiche : chaque ajout ou retrait est enregistré, avec « Annuler ». */
export function MemberTags({ memberId, tags }: { memberId: string; tags: string[] }) {
  const { value, commit } = useAutosave<string[]>(
    tags,
    (next) => setMemberTags({ memberId, tags: next }),
    `etiquettes-${memberId}`,
  );
  return (
    <TagInput
      value={value}
      onChange={(next) => commit(next, t("memberProfile.tagsSaved"))}
      aria-label={t("memberProfile.tags")}
      placeholder={t("memberProfile.tagPlaceholder")}
    />
  );
}
