import { MEMBER_STATUS_TONE, parseSegmentFilters } from "@salle/shared";
import { MailCheckIcon, Trash2Icon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Flash } from "@/components/flash";
import { PageHeader } from "@/components/page-header";
import { SegmentFiltersForm } from "@/components/segments/segment-filters";
import { PendingRegion, UrlStateProvider } from "@/hooks/use-url-state";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isManagerRole, requireRole } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { filtersFromSearch, hasFilters } from "@/lib/segments";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { deleteSegment, saveSegment } from "./actions";

export const metadata: Metadata = { title: t("segments.title") };

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

  // Un seul comptage : celui de l'aperçu ; les joignables par email se lisent dans la liste.
  const {
    data: preview,
    count,
    error,
  } = await supabase
    .rpc("filter_members", { p_gym_id: context.gym.id, p_filters: filters }, { count: "exact" })
    .select("id, first_name, last_name, email, status, marketing_email_consent_at")
    .range(0, PREVIEW - 1);
  if (error) throw new Error(error.message);
  const total = count ?? preview.length;

  return (
    <UrlStateProvider>
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
                <SegmentFiltersForm
                  filters={filters}
                  segmentId={current?.id ?? null}
                  disciplines={disciplines ?? []}
                />
              </CardContent>
            </Card>

            <PendingRegion>
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
                  <div className="grid gap-1">
                    <CardTitle className="tabular-nums" aria-live="polite">
                      {t("segments.count", { count: total })}
                    </CardTitle>
                    <CardDescription>{t("segments.consentHint")}</CardDescription>
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
                      <SubmitButton>
                        {current ? t("segments.update") : t("segments.save")}
                      </SubmitButton>
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
                              <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                                {m.marketing_email_consent_at ? (
                                  <MailCheckIcon
                                    className="size-3.5 shrink-0 text-success"
                                    aria-label={t("segments.emailConsent")}
                                  />
                                ) : null}
                                <span className="truncate">{m.email ?? "—"}</span>
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
            </PendingRegion>
          </div>
        </div>
      </div>
    </UrlStateProvider>
  );
}
