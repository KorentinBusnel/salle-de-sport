"use client";

import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { TriangleAlertIcon } from "lucide-react";
import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useContext,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import type { MovePreview } from "@/app/(app)/planning/move-actions";
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
import { type MessageKey, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SNAP_MINUTES = 15;

type SessionDrag = {
  sessionId: string;
  label: string;
  dayKey: string;
  startMinute: number;
  duration: number;
};
type Target = { dayKey: string; minutes: number };
type Actions = {
  preview: (input: { sessionId: string; dayKey: string; minutes: number }) => Promise<MovePreview>;
  move: (input: {
    sessionId: string;
    dayKey: string;
    minutes: number;
  }) => Promise<{ error: MessageKey | null }>;
};

const DragState = createContext<{
  enabled: boolean;
  target: (Target & { sessionId: string }) | null;
  justDropped: () => boolean;
}>({ enabled: false, target: null, justDropped: () => false });

const hhmm = (minutes: number) =>
  `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;

/**
 * Glisser-déposer du planning (gérant) : une séance glisse vers un autre jour ou une autre
 * heure (pas de 15 min, heure affichée pendant le geste) ; au dépôt, confirmation avec le
 * nombre d'inscrits prévenus et un éventuel chevauchement du coach. La base tranche.
 */
export function WeekDnd({
  enabled,
  pxPerMinute,
  timeZone,
  actions,
  children,
}: {
  enabled: boolean;
  pxPerMinute: number;
  timeZone: string;
  actions: Actions;
  children: ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [target, setTarget] = useState<(Target & { sessionId: string }) | null>(null);
  const [pending, setPending] = useState<{
    drag: SessionDrag;
    to: Target;
    preview: Extract<MovePreview, { error: null }>;
  } | null>(null);
  const [busy, startTransition] = useTransition();
  const droppedAt = useRef(0);

  function compute(event: DragMoveEvent | DragEndEvent): Target | null {
    const drag = event.active.data.current as SessionDrag | undefined;
    if (!drag) return null;
    const dayKey = (event.over?.data.current as { dayKey?: string } | undefined)?.dayKey;
    const raw = drag.startMinute + event.delta.y / pxPerMinute;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    const minutes = Math.min(Math.max(0, snapped), 24 * 60 - drag.duration);
    return { dayKey: dayKey ?? drag.dayKey, minutes };
  }

  function onDragEnd(event: DragEndEvent) {
    droppedAt.current = Date.now();
    setTarget(null);
    const drag = event.active.data.current as SessionDrag | undefined;
    const to = compute(event);
    if (!drag || !to || (to.dayKey === drag.dayKey && to.minutes === drag.startMinute)) return;
    startTransition(async () => {
      const preview = await actions.preview({ sessionId: drag.sessionId, ...to });
      if (preview.error) {
        toast.error(t(preview.error), { closeButton: true });
        return;
      }
      setPending({ drag, to, preview });
    });
  }

  function confirm() {
    if (!pending) return;
    const { drag, to } = pending;
    setPending(null);
    startTransition(async () => {
      const result = await actions.move({ sessionId: drag.sessionId, ...to });
      if (result.error) toast.error(t(result.error), { closeButton: true });
      else toast.success(t("planning.moved"));
    });
  }

  const when = pending
    ? new Intl.DateTimeFormat("fr-FR", {
        timeZone,
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(pending.preview.startsAt))
    : "";
  const notified = pending ? pending.preview.booked + pending.preview.waitlisted : 0;

  return (
    <DragState.Provider
      value={{ enabled, target, justDropped: () => Date.now() - droppedAt.current < 300 }}
    >
      <DndContext
        sensors={sensors}
        onDragMove={(event) => {
          const to = compute(event);
          const id = (event.active.data.current as SessionDrag | undefined)?.sessionId;
          if (to && id) setTarget({ ...to, sessionId: id });
        }}
        onDragCancel={() => setTarget(null)}
        onDragEnd={onDragEnd}
      >
        <div aria-busy={busy}>{children}</div>
      </DndContext>
      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("planning.moveTitle", { label: pending?.drag.label ?? "", when })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {notified > 0
                ? t("planning.moveNotified", { count: notified })
                : t("planning.moveNobody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending?.preview.coachConflict ? (
            <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("planning.moveCoachConflict")}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>{t("planning.moveConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DragState.Provider>
  );
}

/** Colonne d'un jour : zone de dépôt. */
export function DroppableDay({
  dayKey,
  className,
  style,
  children,
}: {
  dayKey: string;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  children: ReactNode;
}) {
  const { enabled } = useContext(DragState);
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayKey}`,
    data: { dayKey },
    disabled: !enabled,
  });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "bg-primary/[0.04]")} style={style}>
      {children}
    </div>
  );
}

/** Bloc de séance déplaçable (positionné par la grille) ; le lien reste cliquable. */
export function DraggableSession({
  drag,
  movable,
  className,
  style,
  children,
}: {
  drag: SessionDrag;
  movable: boolean;
  className?: string | undefined;
  style: CSSProperties;
  children: ReactNode;
}) {
  const { enabled, target, justDropped } = useContext(DragState);
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: drag.sessionId,
    data: drag,
    disabled: !enabled || !movable,
  });
  const live = isDragging && target?.sessionId === drag.sessionId ? target : null;
  return (
    <div
      ref={setNodeRef}
      {...(enabled && movable ? listeners : {})}
      {...(enabled && movable
        ? { "aria-roledescription": attributes["aria-roledescription"] }
        : {})}
      onClickCapture={(event) => {
        // Le relâchement d'un glisser ne doit pas ouvrir la séance.
        if (justDropped()) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      className={cn(
        className,
        enabled && movable && "cursor-grab touch-none",
        isDragging && "z-40 cursor-grabbing opacity-90 shadow-border-hover",
      )}
      style={{
        ...style,
        ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
      }}
    >
      {children}
      {live ? (
        <span className="pointer-events-none absolute -top-6 left-0 z-50 rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-background tabular-nums">
          {hhmm(live.minutes)}
        </span>
      ) : null}
    </div>
  );
}
