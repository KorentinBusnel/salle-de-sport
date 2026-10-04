/** Coachs d'une séance (table session_coaches), coach principal en premier. */
export type SessionCoachRow = {
  position: number;
  coach_id: string;
  coaches: { display_name: string } | null;
};

export const SESSION_COACHES_SELECT = "session_coaches(position, coach_id, coaches(display_name))";

export function sessionCoaches(rows: readonly SessionCoachRow[] | null | undefined) {
  return [...(rows ?? [])]
    .sort((a, b) => a.position - b.position)
    .flatMap((row) => (row.coaches ? [{ id: row.coach_id, name: row.coaches.display_name }] : []));
}
