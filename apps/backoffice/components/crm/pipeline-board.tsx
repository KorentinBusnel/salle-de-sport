"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  type PipelineStage,
  PIPELINE_STAGES,
  pipelineMove,
  TONE_CLASSES,
  type Tone,
} from "@salle/shared";
import { GripVerticalIcon, MoveRightIcon } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
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
export type PipelineColumn = { stage: PipelineStage; total: number; cards: PipelineCard[] };
type Move = { card: PipelineCard; from: PipelineStage; to: PipelineStage };

// Couleurs des étapes : tons partagés (tokens), comme les pastilles de statut.
const STAGE_TONE: Record<PipelineStage, Tone> = {
  lead: "brand",
  trial: "warning",
  active: "success",
  suspended: "neutral",
  cancelled: "danger",
};

/**
 * Pipeline en colonnes : les cartes se glissent d'une étape à l'autre (souris, doigt ou
 * clavier via « Déplacer vers… »). Déplacement optimiste ; la base tranche et la carte revient
 * si la transition est refusée. « Annuler » quand le retour est permis (sinon pas de bouton) ;
 * résilier demande une confirmation. Au téléphone, les colonnes défilent une à une.
 */
export function PipelineBoard({
  columns,
  moreHref,
  action,
}: {
  columns: PipelineColumn[];
  moreHref: Record<PipelineStage, string>;
  action: (input: {
    memberId: string;
    from: PipelineStage;
    to: PipelineStage;
  }) => Promise<{ error: MessageKey | null }>;
}) {
  const [board, applyMove] = useOptimistic(columns, (state, move: Move) =>
    state.map((column) => {
      if (column.stage === move.from)
        return {
          ...column,
          total: column.total - 1,
          cards: column.cards.filter((c) => c.id !== move.card.id),
        };
      if (column.stage === move.to)
        return { ...column, total: column.total + 1, cards: [move.card, ...column.cards] };
      return column;
    }),
  );
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<PipelineCard | null>(null);
  const [confirm, setConfirm] = useState<Move | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function request(move: Move) {
    const rule = pipelineMove(move.from, move.to);
    if (!rule) {
      toast.error(t("crm.errors.notAllowed"), { closeButton: true });
      return;
    }
    if (rule.kind === "status" && rule.confirm) {
      setConfirm(move);
      return;
    }
    run(move);
  }

  function run(move: Move, undoing = false) {
    startTransition(async () => {
      applyMove(move);
      const result = await action({ memberId: move.card.id, from: move.from, to: move.to });
      if (result.error) {
        // Retour refusé (ex. : l'essai a déjà réservé) : la carte reste où la base l'a laissée.
        toast.error(
          undoing ? t("crm.errors.undoRefused", { reason: t(result.error) }) : t(result.error),
          {
            closeButton: true,
          },
        );
        return;
      }
      if (undoing) {
        toast(t("ui.undone"));
        return;
      }
      const back = pipelineMove(move.to, move.from);
      const reversible = back !== null && !(back.kind === "status" && back.confirm);
      toast.success(t("crm.moved", { name: move.card.name, stage: t(`crm.stage.${move.to}`) }), {
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
    const data = event.active.data.current as { card: PipelineCard; stage: PipelineStage };
    const to = event.over?.data.current?.stage as PipelineStage | undefined;
    if (!data || !to || to === data.stage) return;
    request({ card: data.card, from: data.stage, to });
  }

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
          screenReaderInstructions: { draggable: t("crm.dragInstructions") },
        }}
      >
        <div className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:scroll-px-6 md:px-6 xl:snap-none">
          <div className="grid auto-cols-[min(85vw,18rem)] grid-flow-col gap-3 xl:grid-flow-row xl:grid-cols-5">
            {board.map((column) => (
              <Column
                key={column.stage}
                column={column}
                moreHref={moreHref[column.stage]}
                onMove={(card, to) => request({ card, from: column.stage, to })}
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
  moreHref,
  onMove,
}: {
  column: PipelineColumn;
  moreHref: string;
  onMove: (card: PipelineCard, to: PipelineStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${column.stage}`,
    data: { stage: column.stage },
  });
  const hidden = column.total - column.cards.length;
  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`col-${column.stage}`}
      className={cn(
        "grid min-h-40 snap-start content-start gap-2 rounded-xl bg-muted/60 p-2 transition-colors",
        isOver && "bg-accent ring-2 ring-ring/40",
      )}
    >
      <h2
        id={`col-${column.stage}`}
        className="flex items-center gap-2 px-1 py-1 text-sm font-medium"
      >
        <span
          aria-hidden
          className={cn("size-2 rounded-full", TONE_CLASSES[STAGE_TONE[column.stage]].dot)}
        />
        {t(`crm.stage.${column.stage}`)}
        <span className="ml-auto text-muted-foreground tabular-nums">{column.total}</span>
      </h2>
      {column.cards.map((card) => (
        <DraggableCard key={card.id} card={card} stage={column.stage} onMove={onMove} />
      ))}
      {column.cards.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          {t("crm.dropHere")}
        </p>
      ) : null}
      {hidden > 0 ? (
        <Link
          href={moreHref}
          className="px-1 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("crm.more", { count: hidden })}
        </Link>
      ) : null}
    </section>
  );
}

function DraggableCard({
  card,
  stage,
  onMove,
}: {
  card: PipelineCard;
  stage: PipelineStage;
  onMove: (card: PipelineCard, to: PipelineStage) => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: card.id,
    data: { card, stage },
  });
  const targets = PIPELINE_STAGES.filter((to) => pipelineMove(stage, to) !== null);
  return (
    <div ref={setNodeRef} className={cn("relative", isDragging && "opacity-40")}>
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
              <GripVerticalIcon className="size-4" />
            </button>
            {targets.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("crm.moveTo", { name: card.name })}
                    className="relative z-10 text-muted-foreground"
                  >
                    <MoveRightIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t("crm.moveToLabel")}</DropdownMenuLabel>
                  {targets.map((to) => (
                    <DropdownMenuItem key={to} onSelect={() => onMove(card, to)}>
                      {t(`crm.stage.${to}`)}
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
