"use client";

import {
  HOME_BLOCKS_BY_ROLE,
  type HomeBlock,
  type LayoutRole,
  NAV_BADGES_BY_ROLE,
  type NavBadge,
} from "@salle/shared";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useId, useState } from "react";
import { saveDeskSlot, saveLayout } from "@/app/(app)/parametres/actions";
import { SettingRow, useAutosave } from "@/components/settings/setting-rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";

/** Créneau proposé pour une nouvelle permanence (début et fin). */
export function DeskSlotRow({ start, end }: { start: string; end: string }) {
  const id = useId();
  const { value, commit } = useAutosave({ start, end }, (next) => saveDeskSlot(next), "desk-slot");
  const [draft, setDraft] = useState(value);
  // Valeur rétablie par « Annuler » : la saisie suit.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(value);
  }
  const invalid = draft.end <= draft.start;
  const label = t("settings.accueil.defaultSlot");
  return (
    <SettingRow
      id={id}
      label={label}
      hint={t("settings.accueil.defaultSlotHint")}
      error={invalid ? t("settings.errors.slot") : null}
    >
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="time"
          step={300}
          value={draft.start}
          aria-label={`${label} : ${t("settings.hours.from")}`}
          aria-invalid={invalid || undefined}
          onChange={(event) => setDraft({ ...draft, start: event.target.value })}
          onBlur={() => !invalid && commit(draft, `${label} : ${t("settings.saved")}`)}
          className="w-32 tabular-nums"
        />
        <span aria-hidden className="text-muted-foreground">
          –
        </span>
        <Input
          type="time"
          step={300}
          value={draft.end}
          aria-label={`${label} : ${t("settings.hours.to")}`}
          aria-invalid={invalid || undefined}
          onChange={(event) => setDraft({ ...draft, end: event.target.value })}
          onBlur={() => !invalid && commit(draft, `${label} : ${t("settings.saved")}`)}
          className="w-32 tabular-nums"
        />
      </div>
    </SettingRow>
  );
}

/**
 * Accueil d'un rôle : blocs affichés (interrupteur) et leur ordre (Monter / Descendre), puis
 * pastilles de la barre latérale. Chaque changement est enregistré, avec « Annuler ».
 */
export function RoleLayoutCard({
  role,
  blocks,
  badges,
}: {
  role: LayoutRole;
  blocks: HomeBlock[];
  badges: NavBadge[];
}) {
  const roleLabel = t(`roles.${role}`);
  const shownBlocks = useAutosave(
    blocks,
    (values) => saveLayout({ role, kind: "home_blocks", values }),
    `blocks-${role}`,
  );
  const shownBadges = useAutosave(
    badges,
    (values) => saveLayout({ role, kind: "nav_badges", values }),
    `badges-${role}`,
  );
  const allowed = HOME_BLOCKS_BY_ROLE[role];
  // Blocs affichés dans leur ordre, puis les blocs masqués.
  const ordered = [
    ...shownBlocks.value,
    ...allowed.filter((block) => !shownBlocks.value.includes(block)),
  ];
  const message = `${roleLabel} : ${t("settings.saved")}`;

  function move(block: HomeBlock, direction: -1 | 1) {
    const list = [...shownBlocks.value];
    const index = list.indexOf(block);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target] as HomeBlock, block];
    shownBlocks.commit(list, message);
  }

  return (
    <section className="grid gap-4 rounded-xl p-4 shadow-border" aria-labelledby={`role-${role}`}>
      <h3 id={`role-${role}`} className="font-semibold">
        {roleLabel}
      </h3>
      <div className="grid gap-2">
        <h4 className="text-sm text-muted-foreground">{t("settings.accueil.blocks")}</h4>
        <ol className="grid gap-1">
          {ordered.map((block) => {
            const shown = shownBlocks.value.includes(block);
            const index = shownBlocks.value.indexOf(block);
            const label = t(`settings.accueil.block.${block}`);
            return (
              <li
                key={block}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
              >
                <Switch
                  checked={shown}
                  aria-label={t("settings.accueil.show", { label })}
                  onCheckedChange={(checked) =>
                    shownBlocks.commit(
                      checked
                        ? [...shownBlocks.value, block]
                        : shownBlocks.value.filter((b) => b !== block),
                      message,
                    )
                  }
                />
                <span className="grid min-w-0 flex-1">
                  <span className={shown ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
                    {label}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t(`settings.accueil.blockHint.${block}`)}
                  </span>
                </span>
                <span className="flex gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!shown || index === 0}
                    aria-label={t("settings.accueil.moveUp", { label })}
                    onClick={() => move(block, -1)}
                  >
                    <ArrowUpIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={!shown || index === shownBlocks.value.length - 1}
                    aria-label={t("settings.accueil.moveDown", { label })}
                    onClick={() => move(block, 1)}
                  >
                    <ArrowDownIcon aria-hidden />
                  </Button>
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-2">
        <h4 className="text-sm text-muted-foreground">{t("settings.accueil.badges")}</h4>
        {NAV_BADGES_BY_ROLE[role].length ? (
          <ul className="grid gap-1">
            {NAV_BADGES_BY_ROLE[role].map((badge) => {
              const label = t(`settings.accueil.badge.${badge}`);
              const shown = shownBadges.value.includes(badge);
              return (
                <li key={badge} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                  <Switch
                    checked={shown}
                    aria-label={t("settings.accueil.show", { label })}
                    onCheckedChange={(checked) =>
                      shownBadges.commit(
                        checked
                          ? [...shownBadges.value, badge]
                          : shownBadges.value.filter((b) => b !== badge),
                        message,
                      )
                    }
                  />
                  <span className="text-sm">{label}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-2 text-sm text-muted-foreground">{t("settings.accueil.noBadge")}</p>
        )}
      </div>
    </section>
  );
}
