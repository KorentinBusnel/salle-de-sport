"use client";

import type { OpeningHours } from "@salle/shared";
import { ImageUpIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addClosure,
  removeClosure,
  removeLogo,
  saveIdentity,
  saveOpeningHours,
  uploadLogo,
} from "@/app/(app)/parametres/actions";
import { DateField, formatDateKey } from "@/components/forms/date-fields";
import { WeeklySlotsEditor } from "@/components/forms/weekly-slots-editor";
import {
  SettingRow,
  SettingRows,
  SettingTextRow,
  useAutosave,
} from "@/components/settings/setting-rows";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/action-result";
import { initials } from "@/lib/format";
import { t } from "@/lib/i18n";
import { toastUndo } from "@/lib/toast-undo";

const outcome = (result: ActionResult) => (result.ok ? {} : { error: result.error });

export type GymIdentityView = {
  name: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  logoUrl: string | null;
};

/** Identité de la salle : champs enregistrés à la sortie, logo, fuseau en lecture seule. */
export function IdentityCard({ identity }: { identity: GymIdentityView }) {
  const save = (field: "name" | "address" | "phone" | "email") => (value: string) =>
    saveIdentity({ field, value });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.identity.title")}</CardTitle>
        <CardDescription>{t("settings.identity.hint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <SettingRows>
          <LogoRow name={identity.name} logoUrl={identity.logoUrl} />
          <SettingTextRow
            label={t("settings.identity.name")}
            value={identity.name}
            save={save("name")}
            maxLength={80}
            autoComplete="organization"
          />
          <SettingTextRow
            label={t("settings.identity.address")}
            value={identity.address}
            save={save("address")}
            maxLength={200}
            autoComplete="street-address"
          />
          <SettingTextRow
            label={t("settings.identity.phone")}
            value={identity.phone}
            type="tel"
            save={save("phone")}
            maxLength={30}
            autoComplete="tel"
          />
          <SettingTextRow
            label={t("settings.identity.email")}
            value={identity.email}
            type="email"
            save={save("email")}
            maxLength={120}
            autoComplete="email"
          />
          <SettingRow
            id="timezone"
            label={t("settings.identity.timezone")}
            hint={t("settings.identity.timezoneHint")}
          >
            <Input id="timezone" value={identity.timezone} readOnly className="w-full sm:w-80" />
          </SettingRow>
        </SettingRows>
      </CardContent>
    </Card>
  );
}

function LogoRow({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function send(file: File) {
    const data = new FormData();
    data.set("logo", file);
    start(async () => {
      const result = await uploadLogo(data);
      if (result.ok) toast.success(t("settings.logo.saved"));
      else toast.error(t(result.error), { closeButton: true });
      router.refresh();
    });
  }

  return (
    <SettingRow id={id} label={t("settings.logo.title")} hint={t("settings.logo.hint")}>
      <div className="flex items-center gap-3">
        <Avatar className="size-12 rounded-xl shadow-border">
          {logoUrl ? (
            <AvatarImage
              src={logoUrl}
              alt={t("settings.logo.alt", { gym: name })}
              className="rounded-[inherit] object-contain"
            />
          ) : null}
          <AvatarFallback className="rounded-xl bg-primary font-semibold text-primary-foreground">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) send(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => input.current?.click()}
        >
          {pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <ImageUpIcon data-icon="inline-start" aria-hidden />
          )}
          {pending
            ? t("settings.logo.uploading")
            : logoUrl
              ? t("settings.logo.replace")
              : t("settings.logo.upload")}
        </Button>
        {logoUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending}
            aria-label={t("settings.logo.remove")}
            onClick={() =>
              start(async () => {
                const result = await removeLogo();
                if (result.ok) toast.success(t("settings.logo.removed"));
                else toast.error(t(result.error), { closeButton: true });
                router.refresh();
              })
            }
          >
            <Trash2Icon aria-hidden />
          </Button>
        ) : null}
      </div>
    </SettingRow>
  );
}

/** Horaires d'ouverture : chaque modification valide est enregistrée, avec « Annuler ». */
export function OpeningHoursCard({ hours }: { hours: OpeningHours }) {
  const { value, commit } = useAutosave<OpeningHours>(
    hours,
    (next) => saveOpeningHours(next),
    "opening-hours",
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.hours.title")}</CardTitle>
        <CardDescription>{t("settings.hours.hint")}</CardDescription>
      </CardHeader>
      <CardContent>
        <WeeklySlotsEditor
          value={value}
          onCommit={(next) => commit(next, t("settings.hours.saved"))}
        />
      </CardContent>
    </Card>
  );
}

export type ClosureView = { id: string; day: string; label: string };

/** Jours de fermeture à venir : ajout par date et motif, retrait avec « Annuler ». */
export function ClosuresCard({
  closures,
  todayKey,
}: {
  closures: ClosureView[];
  todayKey: string;
}) {
  const router = useRouter();
  const [day, setDay] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState<string[]>([]);
  const labelId = useId();
  const dayId = useId();

  function add() {
    start(async () => {
      const result = await addClosure({ day: day ?? "", label });
      if (!result.ok) {
        setError(t(result.error));
        return;
      }
      setError(null);
      setDay(null);
      setLabel("");
      toast.success(t("settings.closures.added"));
      router.refresh();
    });
  }

  const visible = closures.filter((closure) => !hidden.includes(closure.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.closures.title")}</CardTitle>
        <CardDescription>{t("settings.closures.hint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          className="grid gap-2 sm:grid-cols-[14rem_minmax(0,1fr)_auto] sm:items-end"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <div className="grid gap-1.5">
            <label htmlFor={dayId} className="text-sm font-medium">
              {t("settings.closures.day")}
            </label>
            <DateField id={dayId} value={day} onChange={setDay} min={todayKey} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={labelId} className="text-sm font-medium">
              {t("settings.closures.label")}
            </label>
            <Input
              id={labelId}
              value={label}
              maxLength={80}
              placeholder={t("settings.closures.labelPlaceholder")}
              aria-invalid={error ? true : undefined}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {t("settings.closures.add")}
          </Button>
          {error ? (
            <p role="alert" className="text-sm text-destructive sm:col-span-3">
              {error}
            </p>
          ) : null}
        </form>

        {visible.length ? (
          <ul className="divide-y rounded-lg border">
            {visible.map((closure) => (
              <li key={closure.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-40 shrink-0 font-medium tabular-nums">
                  {formatDateKey(closure.day)}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {closure.label}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("settings.closures.remove", { day: formatDateKey(closure.day) })}
                  onClick={() => {
                    setHidden((ids) => [...ids, closure.id]);
                    toastUndo({
                      message: t("settings.closures.removed"),
                      mode: "deferred",
                      run: async () => {
                        const result = await removeClosure({ id: closure.id });
                        if (!result.ok) setHidden((ids) => ids.filter((id) => id !== closure.id));
                        return outcome(result);
                      },
                      // « Annuler » : rien n'est parti, la ligne revient.
                      onUndo: () => setHidden((ids) => ids.filter((id) => id !== closure.id)),
                      onSettled: () => router.refresh(),
                    });
                  }}
                >
                  <XIcon aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("settings.closures.empty")}</p>
        )}
      </CardContent>
    </Card>
  );
}
