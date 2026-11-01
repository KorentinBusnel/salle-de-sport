"use client";

import {
  VIEW_NAME_MAX,
  type MemberLayout,
  type MemberView,
  type MemberViewState,
  type ViewVisibility,
} from "@salle/shared";
import {
  CopyIcon,
  ListFilterIcon,
  LockIcon,
  PencilIcon,
  SaveIcon,
  Trash2Icon,
  Users2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createMemberView,
  deleteMemberView,
  renameMemberView,
  setMemberViewVisibility,
  updateMemberView,
} from "@/app/(app)/adherents/vues-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RowActionsMenu, type RowAction } from "@/components/data-table/row-actions-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ViewTab = {
  id: string;
  name: string;
  builtin: boolean;
  visibility: ViewVisibility;
  /** Compte affiché sur l'onglet (vues intégrées). */
  count?: number | undefined;
  /** Compte mis en avant (quelque chose attend : « À activer »). */
  highlight?: boolean | undefined;
};

type SaveState = {
  filters: MemberViewState["filters"];
  sort: MemberViewState["sort"];
  columns: string[];
  group_by: string | null;
};

/**
 * Barre de vues d'une page (Watermelon tabs) : onglets des vues de sa disposition (intégrées
 * puis enregistrées), « Enregistrer » / « Enregistrer comme… » quand l'état de l'URL diffère de
 * la vue ouverte, et menu de la vue (renommer, dupliquer, partager, supprimer). Une vue
 * personnelle n'appartient qu'à son créateur ; une vue d'équipe, au gérant.
 */
export function ViewBar({
  tabs,
  current,
  state,
  dirty,
  userId,
  manager,
  basePath,
  layout = "table",
  segmentHref,
}: {
  tabs: ViewTab[];
  current: MemberView;
  state: MemberViewState;
  dirty: boolean;
  userId: string;
  manager: boolean;
  /** Page qui porte la barre (`/adherents`, `/crm`) : un onglet ouvre `?vue=`. */
  basePath: string;
  /** Disposition des vues créées depuis cette page. */
  layout?: MemberLayout | undefined;
  /** Gérant : « Créer un segment avec ces filtres » (null sinon). */
  segmentHref?: string | null | undefined;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saveAs, setSaveAs] = useState<{ name: string } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const saveState: SaveState = {
    filters: state.filters,
    sort: state.sort,
    columns: state.columns,
    group_by: state.groupBy,
  };

  const owner = current.createdBy === userId;
  const canEdit = !current.builtin && (current.visibility === "private" ? owner : manager);

  function save() {
    startTransition(async () => {
      const result = await updateMemberView({ id: current.id, state: saveState });
      if (!result.ok) toast.error(t(result.error), { closeButton: true });
      else toast.success(t("views.saved"));
    });
  }
  function setVisibility(visibility: ViewVisibility) {
    startTransition(async () => {
      const result = await setMemberViewVisibility({ id: current.id, visibility });
      if (!result.ok) toast.error(t(result.error), { closeButton: true });
      else if (result.message) toast.success(t(result.message));
    });
  }
  function remove() {
    startTransition(async () => {
      const result = await deleteMemberView({ id: current.id });
      if (!result.ok) {
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      setDeleting(false);
      toast.success(t("views.deleted"));
      router.replace(basePath);
    });
  }

  const actions: RowAction[] = [
    {
      label: t("views.duplicate"),
      icon: CopyIcon,
      onSelect: () => setSaveAs({ name: `${current.name}${t("views.copySuffix")}` }),
    },
    ...(canEdit
      ? [{ label: t("views.rename"), icon: PencilIcon, onSelect: () => setRenaming(true) }]
      : []),
    ...(!current.builtin && current.visibility === "private" && owner && manager
      ? [{ label: t("views.share"), icon: Users2Icon, onSelect: () => setVisibility("team") }]
      : []),
    ...(!current.builtin && current.visibility === "team" && owner
      ? [{ label: t("views.unshare"), icon: LockIcon, onSelect: () => setVisibility("private") }]
      : []),
    ...(segmentHref
      ? [
          {
            label: t("views.createSegment"),
            icon: ListFilterIcon,
            href: segmentHref,
            separated: true,
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            label: t("views.delete"),
            icon: Trash2Icon,
            destructive: true,
            separated: true,
            onSelect: () => setDeleting(true),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      {/* Défilement des onglets au téléphone sans élargir la colonne. */}
      <div className="w-full min-w-0 overflow-x-auto xl:w-auto">
        <nav aria-label={t("views.tabs")} className="flex w-fit gap-1 rounded-xl bg-muted p-1">
          {tabs.map((tab) => {
            const active = tab.id === current.id;
            return (
              <Link
                key={tab.id}
                href={`${basePath}?vue=${tab.id}`}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors pointer-coarse:py-2.5",
                  active
                    ? "bg-card font-medium text-foreground shadow-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.visibility === "private" && !tab.builtin ? (
                  <LockIcon aria-hidden className="size-3 opacity-60" />
                ) : null}
                {tab.name}
                {tab.count !== undefined ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      tab.highlight ? "bg-primary text-primary-foreground" : "bg-background",
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1.5">
        {dirty ? (
          <>
            <span
              className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
              title={t("views.dirtyHint")}
            >
              {t("views.dirty")}
            </span>
            {canEdit ? (
              <Button type="button" variant="outline" size="sm" onClick={save} disabled={pending}>
                {pending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SaveIcon data-icon="inline-start" aria-hidden />
                )}
                {t("views.save")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant={canEdit ? "ghost" : "outline"}
              size="sm"
              onClick={() =>
                setSaveAs({
                  name: current.builtin ? "" : `${current.name}${t("views.copySuffix")}`,
                })
              }
            >
              {t("views.saveAs")}
            </Button>
          </>
        ) : null}
        <RowActionsMenu label={current.name} actions={actions} />
      </div>

      {saveAs ? (
        <SaveViewDialog
          initialName={saveAs.name}
          manager={manager}
          onClose={() => setSaveAs(null)}
          onSubmit={(name, visibility) =>
            startTransition(async () => {
              const result = await createMemberView({
                name,
                visibility,
                layout,
                state: saveState,
              });
              if (!result.ok) {
                toast.error(t(result.error), { closeButton: true });
                return;
              }
              setSaveAs(null);
              toast.success(t("views.created"));
              router.replace(`${basePath}?vue=${result.data.id}`);
            })
          }
          pending={pending}
        />
      ) : null}
      {renaming ? (
        <RenameViewDialog
          initialName={current.name}
          onClose={() => setRenaming(false)}
          onSubmit={(name) =>
            startTransition(async () => {
              const result = await renameMemberView({ id: current.id, name });
              if (!result.ok) {
                toast.error(t(result.error), { closeButton: true });
                return;
              }
              setRenaming(false);
              toast.success(t("views.renamed"));
            })
          }
          pending={pending}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("views.deleteTitle", { name: current.name })}
        description={t("views.deleteConfirm")}
        confirmLabel={t("common.delete")}
        action={remove}
      />
    </div>
  );
}

function SaveViewDialog({
  initialName,
  manager,
  onClose,
  onSubmit,
  pending,
}: {
  initialName: string;
  manager: boolean;
  onClose: () => void;
  onSubmit: (name: string, visibility: ViewVisibility) => void;
  pending: boolean;
}) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const [visibility, setVisibility] = useState<ViewVisibility>("private");
  const valid = name.trim().length > 0 && name.trim().length <= VIEW_NAME_MAX;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) onSubmit(name.trim(), manager ? visibility : "private");
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("views.saveAsTitle")}</DialogTitle>
            <DialogDescription>{t("views.saveAsHint")}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>{t("views.name")}</FieldLabel>
            <Input
              id={`${id}-name`}
              autoFocus
              value={name}
              maxLength={VIEW_NAME_MAX}
              placeholder={t("views.namePlaceholder")}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          {manager ? (
            <Field>
              <FieldLabel htmlFor={`${id}-visibility`}>{t("views.visibility")}</FieldLabel>
              <NativeSelect
                id={`${id}-visibility`}
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value === "team" ? "team" : "private")
                }
              >
                <NativeSelectOption value="private">{t("views.private")}</NativeSelectOption>
                <NativeSelectOption value="team">{t("views.team")}</NativeSelectOption>
              </NativeSelect>
              <FieldDescription>
                {visibility === "team" ? t("views.teamHint") : t("views.privateHint")}
              </FieldDescription>
            </Field>
          ) : (
            <p className="text-sm text-muted-foreground">{t("views.privateHint")}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {t("views.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameViewDialog({
  initialName,
  onClose,
  onSubmit,
  pending,
}: {
  initialName: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
  pending: boolean;
}) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const valid = name.trim().length > 0 && name.trim().length <= VIEW_NAME_MAX;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) onSubmit(name.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("views.renameTitle")}</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>{t("views.name")}</FieldLabel>
            <Input
              id={`${id}-name`}
              autoFocus
              value={name}
              maxLength={VIEW_NAME_MAX}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!valid || pending}>
              {t("views.rename")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
