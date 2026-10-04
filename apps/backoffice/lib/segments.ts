import { parseSegmentFilters, type SegmentFilters } from "@salle/shared";

/** Filtres de segment ⇄ paramètres d'URL (formulaire en GET : aperçu partageable). */
export function filtersFromSearch(params: Record<string, string | string[] | undefined>) {
  const list = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
  };
  const int = (key: string) => {
    const value = params[key];
    const text = Array.isArray(value) ? value[0] : value;
    return text && /^\d+$/.test(text) ? Number(text) : undefined;
  };
  const text = (key: string) => {
    const value = params[key];
    const v = (Array.isArray(value) ? value[0] : value)?.trim();
    return v || undefined;
  };
  return parseSegmentFilters({
    statuses: list("statuses"),
    tags: (text("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
    inactive_days: int("inactive_days"),
    discipline_id: text("discipline_id"),
    max_credits: int("max_credits"),
    joined_since: text("joined_since"),
    birthday_month: params.birthday_month === "on" ? true : undefined,
    email_consent: params.email_consent === "on" ? true : undefined,
  });
}

export function filtersToSearch(filters: SegmentFilters): string {
  const query = new URLSearchParams();
  for (const status of filters.statuses ?? []) query.append("statuses", status);
  if (filters.tags?.length) query.set("tags", filters.tags.join(","));
  if (filters.inactive_days !== undefined)
    query.set("inactive_days", String(filters.inactive_days));
  if (filters.discipline_id) query.set("discipline_id", filters.discipline_id);
  if (filters.max_credits !== undefined) query.set("max_credits", String(filters.max_credits));
  if (filters.joined_since) query.set("joined_since", filters.joined_since);
  if (filters.birthday_month) query.set("birthday_month", "on");
  if (filters.email_consent) query.set("email_consent", "on");
  return query.toString();
}

/** Liste lisible des filtres (pour les cartes de segments). */
export function hasFilters(filters: SegmentFilters): boolean {
  return Object.keys(filters).some((key) => {
    const value = filters[key as keyof SegmentFilters];
    return Array.isArray(value) ? value.length > 0 : value !== undefined;
  });
}
