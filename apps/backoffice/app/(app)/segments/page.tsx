import { MEMBER_STATUS_TONE, parseSegmentFilters } from "@salle/shared";
import { Trash2Icon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { isManagerRole, requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { filtersFromSearch, hasFilters } from "@/lib/segments";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { deleteSegment, saveSegment } from "./actions";

export const metadata: Metadata = { title: t("segments.title") };

const STATUSES = ["prospect", "active", "suspended", "cancelled"] as const;
const PREVIEW = 50;

/** Segments dynamiques : filtres combinés, aperçu immédiat, enregistrement nommé. */
export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = await requireRole(isManagerRole);
  const supabase = await createClient();
  const segmentId = typeof params.segment === "string" ? params.segment : undefined;

  const [{ data: segments }, { data: disciplines }] = await Promise.all([
    supabase
      .from("segments")
      .select("id, name, filters")
      .eq("gym_id", context.gym.id)
      .order("name"),
    supabase
      .from("disciplines")
      .select("id, name")
      .eq("gym_id", context.gym.id)
      .order("position")
      .order("name"),
  ]);
  const current = segments?.find((s) => s.id === segmentId);
  // Un segment ouvert sans filtres dans l'URL : ses filtres enregistrés.
  const fromUrl = filtersFromSearch(params);
  const filters = current && !hasFilters(fromUrl) ? parseSegmentFilters(current.filters) : fromUrl;

  const { data: preview, error } = await supabase
    .rpc("filter_members", { p_gym_id: context.gym.id, p_filters: filters }, { count: "exact" })
    .select("id, first_name, last_name, email, status, marketing_email_consent_at")
    .range(0, PREVIEW - 1);
  if (error) throw new Error(error.message);
  // Nombre total et nombre joignable par email (consentement : base des campagnes).
  const [{ count }, { count: consentCount }] = await Promise.all([
    supabase.rpc(
      "filter_members",
      { p_gym_id: context.gym.id, p_filters: filters },
      { count: "exact", head: true },
    ),
    supabase.rpc(
      "filter_members",
      { p_gym_id: context.gym.id, p_filters: { ...filters, email_consent: true } },
      { count: "exact", head: true },
    ),
  ]);
  const total = count ?? preview.length;
  const consenting = consentCount ?? 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        title={t("segments.title")}
        description={t("segments.hint")}
        actions={
          <Button asChild variant="outline">
            <Link href="/crm">{t("nav.crm")}</Link>
          </Button>
        }
      />
      <Flash
        ok={typeof params.ok === "string" ? params.ok : undefined}
        error={typeof params.erreur === "string" ? params.erreur : undefined}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label={t("segments.saved")} className="grid gap-1">
          <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
            {t("segments.saved")}
          </p>
          <Link
            href="/segments"
            aria-current={!current ? "page" : undefined}
            className={cn(
              "rounded-lg px-2 py-1.5 text-sm",
              !current ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted",
            )}
          >
            {t("segments.new")}
          </Link>
          {(segments ?? []).map((s) => (
            <Link
              key={s.id}
              href={`/segments?segment=${s.id}`}
              aria-current={s.id === current?.id ? "page" : undefined}
              className={cn(
                "truncate rounded-lg px-2 py-1.5 text-sm",
                s.id === current?.id
                  ? "bg-accent font-medium text-accent-foreground"
                  : "hover:bg-muted",
              )}
            >
              {s.name}
            </Link>
          ))}
        </nav>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{current?.name ?? t("segments.filters")}</CardTitle>
              <CardDescription>{t("segments.filtersHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form method="get" className="grid gap-6">
                {current ? <input type="hidden" name="segment" value={current.id} /> : null}
                <FieldGroup className="grid gap-5 md:grid-cols-2">
                  <FieldSet className="md:col-span-2">
                    <FieldLegend variant="label">{t("segments.status")}</FieldLegend>
                    <div className="flex flex-wrap gap-4">
                      {STATUSES.map((status) => (
                        <label key={status} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            name="statuses"
                            value={status}
                            defaultChecked={filters.statuses?.includes(status) ?? false}
                          />
                          {t(`memberStatus.${status}`)}
                        </label>
                      ))}
                    </div>
                  </FieldSet>
                  <Field>
                    <FieldLabel htmlFor="f-tags">{t("segments.tags")}</FieldLabel>
                    <Input
                      id="f-tags"
                      name="tags"
                      placeholder="hyrox, blessure"
                      defaultValue={filters.tags?.join(", ") ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="f-inactive">{t("segments.inactiveDays")}</FieldLabel>
                    <Input
                      id="f-inactive"
                      name="inactive_days"
                      type="number"
                      min={1}
                      max={365}
                      className="w-28"
                      defaultValue={filters.inactive_days ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="f-discipline">{t("segments.discipline")}</FieldLabel>
                    <NativeSelect
                      id="f-discipline"
                      name="discipline_id"
                      defaultValue={filters.discipline_id ?? ""}
                    >
                      <NativeSelectOption value="">{t("segments.any")}</NativeSelectOption>
                      {(disciplines ?? []).map((d) => (
                        <NativeSelectOption key={d.id} value={d.id}>
                          {d.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="f-credits">{t("segments.maxCredits")}</FieldLabel>
                    <Input
                      id="f-credits"
                      name="max_credits"
                      type="number"
                      min={0}
                      max={100}
                      className="w-28"
                      defaultValue={filters.max_credits ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="f-joined">{t("segments.joinedSince")}</FieldLabel>
                    <Input
                      id="f-joined"
                      name="joined_since"
                      type="date"
                      className="w-44"
                      defaultValue={filters.joined_since ?? ""}
                    />
                  </Field>
                  <div className="grid content-end gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        name="birthday_month"
                        defaultChecked={filters.birthday_month ?? false}
                      />
                      {t("segments.birthdayMonth")}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        name="email_consent"
                        defaultChecked={filters.email_consent ?? false}
                      />
                      {t("segments.emailConsent")}
                    </label>
                  </div>
                </FieldGroup>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">{t("segments.preview")}</Button>
                  <Button asChild variant="ghost">
                    <Link href={current ? `/segments?segment=${current.id}` : "/segments"}>
                      {t("segments.reset")}
                    </Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
              <div className="grid gap-1">
                <CardTitle>{t("segments.count", { count: total })}</CardTitle>
                <CardDescription>{t("segments.consenting", { count: consenting })}</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={saveSegment} className="flex gap-2">
                  <input type="hidden" name="filters" value={JSON.stringify(filters)} />
                  {current ? <input type="hidden" name="segmentId" value={current.id} /> : null}
                  <Input
                    name="name"
                    required
                    maxLength={80}
                    defaultValue={current?.name ?? ""}
                    placeholder={t("segments.namePlaceholder")}
                    aria-label={t("segments.name")}
                    className="w-56"
                  />
                  <SubmitButton>{current ? t("segments.update") : t("segments.save")}</SubmitButton>
                </form>
                {current ? (
                  <form action={deleteSegment}>
                    <input type="hidden" name="segmentId" value={current.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label={t("segments.delete")}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2Icon />
                    </Button>
                  </form>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {preview.length === 0 ? (
                <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <UsersIcon className="size-4" aria-hidden />
                  {t("segments.empty")}
                </p>
              ) : (
                <ul className="-mx-2 grid sm:grid-cols-2">
                  {preview.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/adherents/${m.id}`}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {m.first_name} {m.last_name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {m.email ?? "—"}
                          </span>
                        </span>
                        <StatusPill tone={MEMBER_STATUS_TONE[m.status]}>
                          {t(`memberStatus.${m.status}`)}
                        </StatusPill>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {total > PREVIEW ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("segments.previewLimit", { count: PREVIEW })}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
