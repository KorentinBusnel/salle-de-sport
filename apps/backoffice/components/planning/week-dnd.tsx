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
import type { CellSave } from "@/components/inline/editable-cell";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
  /** Issue d'un cours récurrent : demander la portée d'un redimensionnement. */
  recurring: boolean;
};
type Target = { dayKey: string; minutes: number };
type Actions = {
  preview: (input: { sessionId: string; dayKey: string; minutes: number }) => Promise<MovePreview>;
  move: (input: {
    sessionId: string;
    dayKey: string;
    minutes: number;
  }) => Promise<{ error: MessageKey | null }>;
  resize: CellSave;
  create: (input: {
    dayKey: string;
    minutes: number;
    disciplineId: string;
  }) => Promise<{ error: MessageKey | null }>;
};

type DragContext = {
  enabled: boolean;
  pxPerMinute: number;
  firstMinute: number;
  target: (Target & { sessionId: string }) | null;
  justDropped: () => boolean;
  markDropped: () => void;
  resize: (drag: SessionDrag, duration: number) => void;
  openCreate: (dayKey: string, minutes: number) => void;
};
const DragState = createContext<DragContext>({
  enabled: false,
  pxPerMinute: 1,
  firstMinute: 0,
  target: null,
  justDropped: () => false,
  markDropped: () => {},
  resize: () => {},
  openCreate: () => {},
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

/**
 * Glisser-déposer du planning (gérant) : une séance glisse vers un autre jour ou une autre
 * heure (pas de 15 min, heure affichée pendant le geste) ; au dépôt, confirmation avec le
 * nombre d'inscrits prévenus et un éventuel chevauchement du coach. La base tranche.
 */
export function WeekDnd({
  enabled,
  pxPerMinute,
  firstMinute,
  timeZone,
  disciplines,
  actions,
  children,
}: {
  enabled: boolean;
  pxPerMinute: number;
  firstMinute: number;
  timeZone: string;
  disciplines: { value: string; label: string }[];
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
  const [resizing, setResizing] = useState<{ drag: SessionDrag; duration: number } | null>(null);
  const [creating, setCreating] = useState<{ dayKey: string; minutes: number } | null>(null);
  const [disciplineId, setDisciplineId] = useState(disciplines[0]?.value ?? "");

  function saveDuration(drag: SessionDrag, duration: number, scope?: "one" | "following") {
    startTransition(async () => {
      const result = await actions.resize({
        id: drag.sessionId,
        field: "duration_minutes",
        value: duration,
        scope,
      });
      if (result.error) toast.error(t(result.error), { closeButton: true });
      else toast.success(t("planning.resized", { minutes: duration }));
    });
  }

  function resize(drag: SessionDrag, duration: number) {
    if (drag.recurring) setResizing({ drag, duration });
    else saveDuration(drag, duration);
  }

  function create() {
    if (!creating || !disciplineId) return;
    const slot = creating;
    setCreating(null);
    startTransition(async () => {
      const result = await actions.create({ ...slot, disciplineId });
      if (result.error) toast.error(t(result.error), { closeButton: true });
      else toast.success(t("planning.created"));
    });
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
      value={{
        enabled,
        pxPerMinute,
        firstMinute,
        target,
        justDropped: () => Date.now() - droppedAt.current < 300,
        markDropped: () => {
          droppedAt.current = Date.now();
        },
        resize,
        openCreate: (dayKey, minutes) => setCreating({ dayKey, minutes }),
      }}
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
      <AlertDialog open={resizing !== null} onOpenChange={(open) => !open && setResizing(null)}>
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
      <AlertDialog open={creating !== null} onOpenChange={(open) => !open && setCreating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("planning.createTitle", {
                when: creating ? `${dayLabel(creating.dayKey)} ${hhmm(creating.minutes)}` : "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("planning.createHint")}</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t("templates.discipline")}</span>
            <NativeSelect
              value={disciplineId}
              onChange={(event) => setDisciplineId(event.target.value)}
              className="w-full"
            >
              {disciplines.map((d) => (
                <NativeSelectOption key={d.value} value={d.value}>
                  {d.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={create} disabled={!disciplineId}>
              {t("planning.createConfirm")}
            </AlertDialogAction>
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
  const { enabled, pxPerMinute, firstMinute, openCreate, justDropped } = useContext(DragState);
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayKey}`,
    data: { dayKey },
    disabled: !enabled,
  });
  return (
    // Gérant : un clic sur un créneau vide propose d'y créer une séance ponctuelle.
    <div
      ref={setNodeRef}
      className={cn(className, isOver && "bg-primary/[0.04]", enabled && "cursor-cell")}
      style={style}
      onClick={(event) => {
        if (!enabled || justDropped()) return;
        if ((event.target as HTMLElement).closest("[data-session]")) return;
        const offset = event.clientY - event.currentTarget.getBoundingClientRect().top;
        const minutes = Math.round((firstMinute + offset / pxPerMinute) / 15) * 15;
        if (minutes >= 0 && minutes < 24 * 60) openCreate(dayKey, minutes);
      }}
    >
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
  const { enabled, target, justDropped, markDropped, resize, pxPerMinute } = useContext(DragState);
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
  return (
    <div
      ref={setNodeRef}
      data-session
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
        ...(extra !== null && typeof style.height === "number"
          ? { height: Math.max(20, style.height + extra), zIndex: 40 }
          : {}),
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
