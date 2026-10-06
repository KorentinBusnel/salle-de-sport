"use client";

import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
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
  startTransition as startUiTransition,
  useContext,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { updateSessionField } from "@/app/(app)/planning/[id]/actions";
import { type MovePreview, moveSession, previewMove } from "@/app/(app)/planning/move-actions";
import {
  type CreateOptions,
  QuickCreateForm,
  quickCreateTitle,
} from "@/components/planning/quick-create";
import { SessionSheet, type SessionSummary } from "@/components/planning/session-sheet";
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
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { t } from "@/lib/i18n";
import { toastUndo } from "@/lib/toast-undo";
import { cn } from "@/lib/utils";
import { DND_INSTRUCTIONS_ID } from "@/lib/week-layout";

const SNAP_MINUTES = 15;

type SessionDrag = {
  sessionId: string;
  label: string;
  dayKey: string;
  startMinute: number;
  duration: number;
  /** Issue d'un cours récurrent : demander la portée d'un redimensionnement. */
  recurring: boolean;
};
type Target = { dayKey: string; minutes: number };
/** Séance déposée, gardée à sa nouvelle place jusqu'à la réponse du serveur. */
type Held = { sessionId: string; fromDay: string; fromMinute: number; x: number; y: number };
type HeldDuration = { sessionId: string; from: number; to: number };

type DragContext = {
  enabled: boolean;
  pxPerMinute: number;
  firstMinute: number;
  target: (Target & { sessionId: string }) | null;
  held: Held | null;
  heldDuration: HeldDuration | null;
  creating: Target | null;
  createOptions: CreateOptions | null;
  justDropped: () => boolean;
  markDropped: () => void;
  resize: (drag: SessionDrag, duration: number) => void;
  openCreate: (target: Target) => void;
  closeCreate: () => void;
};
const DragState = createContext<DragContext>({
  enabled: false,
  pxPerMinute: 1,
  firstMinute: 0,
  target: null,
  held: null,
  heldDuration: null,
  creating: null,
  createOptions: null,
  justDropped: () => false,
  markDropped: () => {},
  resize: () => {},
  openCreate: () => {},
  closeCreate: () => {},
});

/** « mardi 6 octobre » pour une date civile « AAAA-MM-JJ ». */
const dayLabel = (dayKey: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${dayKey}T12:00:00Z`));

const hhmm = (minutes: number) =>
  `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;

const columnRect = (dayKey: string) =>
  document.querySelector(`[data-day-column="${dayKey}"]`)?.getBoundingClientRect();

/**
 * Glisser-déposer du planning (gérant), à la souris ou au clavier (Espace, flèches, Espace) :
 * une séance glisse vers un autre jour ou une autre heure (pas de 15 min) ; au dépôt, elle reste
 * à sa nouvelle place pendant la confirmation (inscrits prévenus, chevauchement du coach), et
 * revient si la base refuse. Un clic sur une séance ouvre son aperçu ; sur un créneau vide, la
 * création rapide.
 */
export function WeekDnd({
  enabled,
  pxPerMinute,
  firstMinute,
  timeZone,
  createOptions,
  sessions,
  children,
}: {
  enabled: boolean;
  pxPerMinute: number;
  firstMinute: number;
  timeZone: string;
  createOptions: CreateOptions | null;
  /** Résumés pour l'aperçu (SessionSheet). */
  sessions: SessionSummary[];
  children: ReactNode;
}) {
  const coordinateGetter: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
    const step = SNAP_MINUTES * pxPerMinute;
    const column = [...context.droppableRects.values()][0]?.width ?? 120;
    switch (event.code) {
      case "ArrowUp":
        return { ...currentCoordinates, y: currentCoordinates.y - step };
      case "ArrowDown":
        return { ...currentCoordinates, y: currentCoordinates.y + step };
      case "ArrowLeft":
        return { ...currentCoordinates, x: currentCoordinates.x - column };
      case "ArrowRight":
        return { ...currentCoordinates, x: currentCoordinates.x + column };
      default:
        return undefined;
    }
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Entrée suit le lien (aperçu) : seul Espace saisit la séance.
    useSensor(KeyboardSensor, {
      coordinateGetter,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );
  const [target, setTarget] = useState<(Target & { sessionId: string }) | null>(null);
  const [held, setHeld] = useState<Held | null>(null);
  const [heldDuration, setHeldDuration] = useState<HeldDuration | null>(null);
  const [pending, setPending] = useState<{
    drag: SessionDrag;
    to: Target;
    preview: Extract<MovePreview, { error: null }>;
  } | null>(null);
  const [busy, startTransition] = useTransition();
  const droppedAt = useRef(0);
  const [resizing, setResizing] = useState<{ drag: SessionDrag; duration: number } | null>(null);
  const [creating, setCreating] = useState<Target | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const justDropped = () => Date.now() - droppedAt.current < 300;

  function saveDuration(drag: SessionDrag, duration: number, scope?: "one" | "following") {
    startTransition(async () => {
      const result = await updateSessionField({
        id: drag.sessionId,
        field: "duration_minutes",
        value: duration,
        scope,
      });
      if (result.error) {
        setHeldDuration(null);
        toast.error(t(result.error), { closeButton: true });
        return;
      }
      toast.success(t("planning.resized", { minutes: duration }));
      startUiTransition(() => setHeldDuration(null));
    });
  }

  function resize(drag: SessionDrag, duration: number) {
    setHeldDuration({ sessionId: drag.sessionId, from: drag.duration, to: duration });
    if (drag.recurring) setResizing({ drag, duration });
    else saveDuration(drag, duration);
  }

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
    const from = columnRect(drag.dayKey);
    const into = columnRect(to.dayKey);
    setHeld({
      sessionId: drag.sessionId,
      fromDay: drag.dayKey,
      fromMinute: drag.startMinute,
      x: from && into ? into.left - from.left : 0,
      y: (to.minutes - drag.startMinute) * pxPerMinute,
    });
    startTransition(async () => {
      const preview = await previewMove({ sessionId: drag.sessionId, ...to });
      if (preview.error) {
        setHeld(null);
        toast.error(t(preview.error), { closeButton: true });
        return;
      }
      setPending({ drag, to, preview });
    });
  }

  function confirm() {
    if (!pending) return;
    const { drag, to, preview } = pending;
    setPending(null);
    const notified = preview.booked + preview.waitlisted;
    const run = async () => {
      const result = await moveSession({ sessionId: drag.sessionId, ...to });
      if (result.error) setHeld(null);
      else startUiTransition(() => setHeld(null));
      return result;
    };
    if (notified === 0) {
      // Personne n'a été prévenu : le déplacement est réversible.
      toastUndo({
        message: t("planning.moved"),
        mode: "inverse",
        run,
        undo: () =>
          moveSession({
            sessionId: drag.sessionId,
            dayKey: drag.dayKey,
            minutes: drag.startMinute,
          }),
      });
      return;
    }
    startTransition(async () => {
      const result = await run();
      if (result.error) toast.error(t(result.error), { closeButton: true });
      else toast.success(t("planning.movedNotified", { count: notified }));
    });
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("planning.dnd.start", { label: (active.data.current as SessionDrag).label }),
    onDragOver: () => undefined,
    onDragEnd: ({ active }) =>
      t("planning.dnd.end", { label: (active.data.current as SessionDrag).label }),
    onDragCancel: ({ active }) =>
      t("planning.dnd.cancel", { label: (active.data.current as SessionDrag).label }),
  };

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
      value={{
        enabled,
        pxPerMinute,
        firstMinute,
        target,
        held,
        heldDuration,
        creating,
        createOptions,
        justDropped,
        markDropped: () => {
          droppedAt.current = Date.now();
        },
        resize,
        openCreate: setCreating,
        closeCreate: () => setCreating(null),
      }}
    >
      <DndContext
        sensors={sensors}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: t("planning.dnd.instructions") },
        }}
        onDragMove={(event) => {
          const to = compute(event);
          const id = (event.active.data.current as SessionDrag | undefined)?.sessionId;
          if (to && id) setTarget({ ...to, sessionId: id });
        }}
        onDragCancel={() => setTarget(null)}
        onDragEnd={onDragEnd}
      >
        <div
          aria-busy={busy}
          onClickCapture={(event) => {
            // Une séance ouvre son aperçu (clic simple) ; Ctrl/⌘-clic garde la fiche.
            const link = (event.target as HTMLElement).closest<HTMLElement>("[data-session-link]");
            if (!link) return;
            if (justDropped()) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
            const id = link.dataset.sessionLink ?? "";
            if (!byId.has(id)) return;
            event.preventDefault();
            event.stopPropagation();
            setSheet(id);
          }}
        >
          {children}
        </div>
      </DndContext>
      {enabled ? (
        <p id={DND_INSTRUCTIONS_ID} className="sr-only">
          {t("planning.dnd.instructions")}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {target
          ? t("planning.dnd.target", { day: dayLabel(target.dayKey), time: hhmm(target.minutes) })
          : ""}
      </p>
      <SessionSheet
        session={sheet ? (byId.get(sheet) ?? null) : null}
        onClose={() => setSheet(null)}
      />
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (open) return;
          // Fermé sans confirmer : la séance revient à sa place.
          if (pending) setHeld(null);
          setPending(null);
        }}
      >
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
      <AlertDialog
        open={resizing !== null}
        onOpenChange={(open) => {
          if (open) return;
          setResizing(null);
          setHeldDuration(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("planning.resizeTitle", {
                label: resizing?.drag.label ?? "",
                minutes: resizing?.duration ?? 0,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("inline.scopeBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (resizing) saveDuration(resizing.drag, resizing.duration, "one");
                setResizing(null);
              }}
            >
              {t("inline.scopeOne")}
            </Button>
            <Button
              onClick={() => {
                if (resizing) saveDuration(resizing.drag, resizing.duration, "following");
                setResizing(null);
              }}
            >
              {t("inline.scopeFollowing")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DragState.Provider>
  );
}

/** Colonne d'un jour : zone de dépôt ; un clic sur un créneau vide propose d'y créer une séance. */
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
  const {
    enabled,
    pxPerMinute,
    firstMinute,
    openCreate,
    closeCreate,
    creating,
    createOptions,
    justDropped,
  } = useContext(DragState);
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayKey}`,
    data: { dayKey },
    disabled: !enabled,
  });
  const canCreate = enabled && createOptions !== null;
  const here = creating && creating.dayKey === dayKey ? creating : null;
  return (
    <div
      ref={setNodeRef}
      data-day-column={dayKey}
      className={cn(className, isOver && "bg-primary/[0.04]", canCreate && "cursor-cell")}
      style={style}
      onClick={(event) => {
        if (!canCreate || justDropped()) return;
        // Les clics dans la fenêtre de création (portail) remontent ici : les ignorer.
        if (!event.currentTarget.contains(event.target as Node)) return;
        if ((event.target as HTMLElement).closest("[data-session]")) return;
        const offset = event.clientY - event.currentTarget.getBoundingClientRect().top;
        const minutes = Math.floor((firstMinute + offset / pxPerMinute) / 15) * 15;
        if (minutes >= 0 && minutes < 24 * 60) openCreate({ dayKey, minutes });
      }}
    >
      {children}
      {here && createOptions ? (
        <Popover open onOpenChange={(open) => !open && closeCreate()}>
          <PopoverAnchor asChild>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-1 z-30 rounded-md border-2 border-dashed border-primary bg-primary/10 px-1.5 py-1 text-xs font-medium text-primary tabular-nums"
              style={{
                top: (here.minutes - firstMinute) * pxPerMinute + 1,
                height: 60 * pxPerMinute - 2,
              }}
            >
              {hhmm(here.minutes)}
            </div>
          </PopoverAnchor>
          <PopoverContent side="right" align="start" className="grid w-80 gap-3">
            <p className="text-sm font-semibold">{quickCreateTitle(dayKey)}</p>
            <QuickCreateForm
              key={`${here.dayKey}-${here.minutes}`}
              options={createOptions}
              dayKey={here.dayKey}
              minutes={here.minutes}
              onDone={closeCreate}
            />
          </PopoverContent>
        </Popover>
      ) : null}
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
  const { enabled, target, held, heldDuration, markDropped, resize, pxPerMinute } =
    useContext(DragState);
  const [extra, setExtra] = useState<number | null>(null);
  const resizeStart = useRef(0);
  const snapDuration = (dy: number) =>
    Math.min(240, Math.max(15, Math.round((drag.duration + dy / pxPerMinute) / 15) * 15));
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: drag.sessionId,
    data: drag,
    disabled: !enabled || !movable,
  });
  const live = isDragging && target?.sessionId === drag.sessionId ? target : null;
  // Valeurs gardées en attendant le serveur, tant que le bloc est encore à son ancienne place.
  const heldHere =
    held &&
    held.sessionId === drag.sessionId &&
    held.fromDay === drag.dayKey &&
    held.fromMinute === drag.startMinute
      ? held
      : null;
  const durationHere =
    heldDuration && heldDuration.sessionId === drag.sessionId && heldDuration.from === drag.duration
      ? heldDuration.to
      : null;
  const shift = transform ?? (heldHere ? { x: heldHere.x, y: heldHere.y } : null);
  const height =
    extra !== null && typeof style.height === "number"
      ? Math.max(20, style.height + extra)
      : durationHere !== null
        ? Math.max(28, durationHere * pxPerMinute - 2)
        : null;
  return (
    <div
      ref={setNodeRef}
      data-session
      data-pending={heldHere || durationHere !== null ? "" : undefined}
      {...(enabled && movable ? listeners : {})}
      {...(enabled && movable
        ? { "aria-roledescription": attributes["aria-roledescription"] }
        : {})}
      className={cn(
        className,
        enabled && movable && "cursor-grab touch-none",
        isDragging && "z-40 cursor-grabbing opacity-90 shadow-border-hover",
        (heldHere || durationHere !== null) && "z-30 opacity-80",
      )}
      style={{
        ...style,
        ...(shift ? { transform: `translate3d(${shift.x}px, ${shift.y}px, 0)` } : {}),
        ...(height !== null ? { height, zIndex: 40 } : {}),
      }}
    >
      {children}
      {enabled && movable ? (
        // Poignée de redimensionnement : changer la durée (pas de 15 min).
        <span
          aria-hidden
          className="absolute inset-x-1 bottom-0 h-2 cursor-ns-resize rounded-b-md hover:bg-foreground/20"
          onPointerDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            resizeStart.current = event.clientY;
            setExtra(0);
          }}
          onPointerMove={(event) => {
            if (extra === null) return;
            setExtra(event.clientY - resizeStart.current);
          }}
          onPointerUp={(event) => {
            if (extra === null) return;
            const duration = snapDuration(event.clientY - resizeStart.current);
            setExtra(null);
            markDropped();
            if (duration !== drag.duration) resize(drag, duration);
          }}
        />
      ) : null}
      {extra !== null ? (
        <span className="pointer-events-none absolute -bottom-6 left-0 z-50 rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-background tabular-nums">
          {snapDuration(extra)} min
        </span>
      ) : null}
      {live ? (
        <span className="pointer-events-none absolute -top-6 left-0 z-50 rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-background tabular-nums">
          {hhmm(live.minutes)}
        </span>
      ) : null}
    </div>
  );
}
