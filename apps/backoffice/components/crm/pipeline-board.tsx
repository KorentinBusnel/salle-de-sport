"use client";

import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  KANBAN_NONE,
  type PipelineStage,
  PIPELINE_STAGES,
  pipelineMove,
  TONE_CLASSES,
  type Tone,
} from "@salle/shared";
import { GripVerticalIcon, MoveRightIcon } from "lucide-react";
import Link from "next/link";
import {
  type CSSProperties,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type MessageKey, t } from "@/lib/i18n";
import { UNDO_DURATION_MS } from "@/lib/toast-undo";
import { cn } from "@/lib/utils";

export type PipelineCard = {
  id: string;
  name: string;
  contact: string;
  bookings: number;
  lastActivity: string;
};
export type BoardColumn = {
  /** Étape, valeur d'option, ou `KANBAN_NONE` (« Sans valeur »). */
  key: string;
  label: string;
  tone: Tone;
  total: number;
  cards: PipelineCard[];
  /** Liste complète de la colonne (« Voir les N autres »). */
  moreHref: string;
};
/** Groupement du tableau : étapes déduites, ou options d'un champ liste. */
export type BoardMode = { kind: "stage" } | { kind: "field"; key: string };
type Move = { card: PipelineCard; from: string; to: string };
type Result = { error: MessageKey | null };

const isStage = (key: string): key is PipelineStage =>
  (PIPELINE_STAGES as readonly string[]).includes(key);

/**
 * Kanban des adhérents : les cartes se glissent d'une colonne à l'autre (souris, doigt ou clavier
 * via « Déplacer vers… »). Par étapes, les transitions suivent `pipelineMove` (statut et tag
 * « essai ») et résilier demande une confirmation ; par champ liste, toute colonne est permise et
 * le déplacement écrit la valeur du champ (« Sans valeur » l'efface). Déplacement optimiste ; la
 * base tranche et la carte revient si elle refuse ; « Annuler » quand le retour est permis.
 * Au téléphone, les colonnes défilent une à une ; au-delà de cinq colonnes aussi sur grand écran.
 */
export function PipelineBoard({
  columns,
  mode,
  moveStage,
  moveField,
}: {
  columns: BoardColumn[];
  mode: BoardMode;
  moveStage: (input: {
    memberId: string;
    from: PipelineStage;
    to: PipelineStage;
  }) => Promise<Result>;
  moveField: (input: { memberId: string; key: string; to: string | null }) => Promise<Result>;
}) {
  const [board, applyMove] = useOptimistic(columns, (state, move: Move) =>
    state.map((column) => {
      if (column.key === move.from)
        return {
          ...column,
          total: column.total - 1,
          cards: column.cards.filter((c) => c.id !== move.card.id),
        };
      if (column.key === move.to)
        return { ...column, total: column.total + 1, cards: [move.card, ...column.cards] };
      return column;
    }),
  );
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<PipelineCard | null>(null);
  const [confirm, setConfirm] = useState<Move | null>(null);
  // Carte déplacée par « Déplacer vers… » : son menu reprend le focus dans sa nouvelle colonne.
  const focusCard = useRef<string | null>(null);
  useEffect(() => {
    if (!focusCard.current) return;
    const trigger = document.querySelector<HTMLElement>(
      `[data-card-id="${CSS.escape(focusCard.current)}"] [data-move-trigger]`,
    );
    if (trigger) {
      trigger.focus();
      focusCard.current = null;
    }
  }, [board]);

  // Clavier : flèches gauche et droite sautent d'une colonne à la voisine.
  const coordinateGetter: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
    const lefts = [...context.droppableRects.values()]
      .map((rect) => rect.left)
      .sort((a, b) => a - b);
    const step = lefts.length > 1 ? (lefts[1] ?? 0) - (lefts[0] ?? 0) : 300;
    if (event.code === "ArrowRight")
      return { ...currentCoordinates, x: currentCoordinates.x + step };
    if (event.code === "ArrowLeft")
      return { ...currentCoordinates, x: currentCoordinates.x - step };
    return undefined;
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );
  const labelOf = (key: string) => columns.find((column) => column.key === key)?.label ?? key;
  const cardName = (data: unknown) =>
    (data as { card?: PipelineCard } | undefined)?.card?.name ?? "";
  const columnOf = (data: unknown) => (data as { column?: string } | undefined)?.column;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t("crm.dnd.start", { name: cardName(active.data.current) }),
    onDragOver: ({ active, over }) => {
      const column = columnOf(over?.data.current);
      return column
        ? t("crm.dnd.over", { name: cardName(active.data.current), column: labelOf(column) })
        : t("crm.dnd.outside", { name: cardName(active.data.current) });
    },
    onDragEnd: ({ active, over }) => {
      const column = columnOf(over?.data.current);
      return column
        ? t("crm.dnd.end", { name: cardName(active.data.current), column: labelOf(column) })
        : t("crm.dnd.cancel", { name: cardName(active.data.current) });
    },
    onDragCancel: ({ active }) => t("crm.dnd.cancel", { name: cardName(active.data.current) }),
  };

  /** Déplacement permis d'une colonne à l'autre (et s'il demande confirmation). */
  function rule(from: string, to: string): { confirm: boolean } | null {
    if (from === to) return null;
    if (mode.kind === "field") return { confirm: false };
    if (!isStage(from) || !isStage(to)) return null;
    const move = pipelineMove(from, to);
    if (!move) return null;
    return { confirm: move.kind === "status" && move.confirm };
  }

  function request(move: Move) {
    const allowed = rule(move.from, move.to);
    if (!allowed) {
      toast.error(t("crm.errors.notAllowed"), { closeButton: true });
      return;
    }
    if (allowed.confirm) {
      setConfirm(move);
      return;
    }
    run(move);
  }

  function send(move: Move): Promise<Result> {
    if (mode.kind === "field")
      return moveField({
        memberId: move.card.id,
        key: mode.key,
        to: move.to === KANBAN_NONE ? null : move.to,
      });
    return moveStage({
      memberId: move.card.id,
      from: move.from as PipelineStage,
      to: move.to as PipelineStage,
    });
  }

  function run(move: Move, undoing = false) {
    startTransition(async () => {
      applyMove(move);
      const result = await send(move);
      if (result.error) {
        // Retour refusé (ex. : l'essai a déjà réservé) : la carte reste où la base l'a laissée.
        toast.error(
          undoing ? t("crm.errors.undoRefused", { reason: t(result.error) }) : t(result.error),
          { closeButton: true },
        );
        return;
      }
      if (undoing) {
        toast(t("ui.undone"));
        return;
      }
      const back = rule(move.to, move.from);
      const reversible = back !== null && !back.confirm;
      toast.success(t("crm.moved", { name: move.card.name, stage: labelOf(move.to) }), {
        id: `crm-${move.card.id}`,
        ...(reversible
          ? {
              duration: UNDO_DURATION_MS,
              action: {
                label: t("ui.undo"),
                onClick: () => run({ card: move.card, from: move.to, to: move.from }, true),
              },
            }
          : {}),
      });
    });
  }

  function onDragEnd(event: DragEndEvent) {
    setDragging(null);
    const data = event.active.data.current as { card: PipelineCard; column: string } | undefined;
    const to = event.over?.data.current?.column as string | undefined;
    if (!data || !to || to === data.column) return;
    request({ card: data.card, from: data.column, to });
  }

  // Jusqu'à cinq colonnes, la grille remplit la largeur sur grand écran ; au-delà, elle défile.
  const fits = board.length <= 5;
  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={(event: DragStartEvent) =>
          setDragging((event.active.data.current as { card: PipelineCard }).card)
        }
        onDragCancel={() => setDragging(null)}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: t("crm.dragInstructions") },
        }}
      >
        <div
          className={cn(
            "-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:scroll-px-6 md:px-6",
            fits && "xl:snap-none",
          )}
        >
          <div
            style={{ "--board-cols": board.length } as CSSProperties}
            className={cn(
              "grid auto-cols-[min(85vw,18rem)] grid-flow-col gap-3",
              fits && "xl:grid-flow-row xl:grid-cols-[repeat(var(--board-cols),minmax(0,1fr))]",
            )}
          >
            {board.map((column) => (
              <Column
                key={column.key}
                column={column}
                targets={board.filter((other) => rule(column.key, other.key) !== null)}
                onMove={(card, to) => {
                  focusCard.current = card.id;
                  request({ card, from: column.key, to });
                }}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {dragging ? <CardBody card={dragging} className="rotate-2 shadow-border-hover" /> : null}
        </DragOverlay>
      </DndContext>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("crm.cancelTitle", { name: confirm?.card.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.from === "lead" || confirm?.from === "trial"
                ? t("crm.cancelLeadBody")
                : t("crm.cancelMemberBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (confirm) run(confirm);
                setConfirm(null);
              }}
            >
              {t("crm.cancelConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Column({
  column,
  targets,
  onMove,
}: {
  column: BoardColumn;
  targets: BoardColumn[];
  onMove: (card: PipelineCard, to: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.key}`,
    data: { column: column.key },
  });
  const hidden = column.total - column.cards.length;
  const headingId = `col-${column.key}`;
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        "grid min-h-40 snap-start content-start gap-2 rounded-xl bg-muted/60 p-2 transition-colors",
        isOver && "bg-accent ring-2 ring-ring/40",
      )}
    >
      <h2 id={headingId} className="flex items-center gap-2 px-1 py-1 text-sm font-medium">
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", TONE_CLASSES[column.tone].dot)}
        />
        <span className="truncate">{column.label}</span>
        <span className="ml-auto text-muted-foreground tabular-nums">{column.total}</span>
      </h2>
      {column.cards.map((card) => (
        <DraggableCard
          key={card.id}
          card={card}
          column={column.key}
          targets={targets}
          onMove={onMove}
        />
      ))}
      {column.cards.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          {t("crm.dropHere")}
        </p>
      ) : null}
      {hidden > 0 ? (
        <Link
          href={column.moreHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-fit text-muted-foreground",
          )}
        >
          {t("crm.more", { count: hidden })}
        </Link>
      ) : null}
    </section>
  );
}

function DraggableCard({
  card,
  column,
  targets,
  onMove,
}: {
  card: PipelineCard;
  column: string;
  targets: BoardColumn[];
  onMove: (card: PipelineCard, to: string) => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: card.id,
    data: { card, column },
  });
  return (
    <div
      ref={setNodeRef}
      data-card-id={card.id}
      className={cn("relative", isDragging && "opacity-40")}
    >
      <CardBody
        card={card}
        handle={
          <span className="flex items-center gap-0.5">
            <button
              type="button"
              {...listeners}
              {...attributes}
              aria-label={t("crm.dragCard", { name: card.name })}
              className="flex size-7 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing pointer-coarse:size-10"
            >
              <GripVerticalIcon aria-hidden className="size-4" />
            </button>
            {targets.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-move-trigger
                    aria-label={t("crm.moveTo", { name: card.name })}
                    className="relative z-10 text-muted-foreground"
                  >
                    <MoveRightIcon aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  // Le focus suit la carte dans sa nouvelle colonne (voir focusCard).
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  <DropdownMenuLabel>{t("crm.moveToLabel")}</DropdownMenuLabel>
                  {targets.map((target) => (
                    <DropdownMenuItem key={target.key} onSelect={() => onMove(card, target.key)}>
                      <span
                        aria-hidden
                        className={cn("size-2 rounded-full", TONE_CLASSES[target.tone].dot)}
                      />
                      {target.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </span>
        }
      />
    </div>
  );
}

function CardBody({
  card,
  handle,
  className,
}: {
  card: PipelineCard;
  handle?: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "relative grid gap-1.5 rounded-lg bg-card p-3 text-sm shadow-border",
        className,
      )}
    >
      <div className="flex items-start gap-1">
        <Link
          href={`/adherents/${card.id}`}
          className="min-w-0 flex-1 truncate font-medium hover:underline"
        >
          {card.name}
        </Link>
        {handle}
      </div>
      <span className="truncate text-xs text-muted-foreground">{card.contact}</span>
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t("crm.bookings", { count: card.bookings })}</span>
        <span className="shrink-0 whitespace-nowrap">{card.lastActivity}</span>
      </span>
    </article>
  );
}
