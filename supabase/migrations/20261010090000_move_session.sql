-- Déplacement d'une séance (glisser-déposer du planning, BRIEF §12) : la séance garde sa
-- durée et ses réservations, les inscrits sont prévenus. Un chevauchement du coach est
-- signalé (aperçu) sans bloquer : le gérant tranche.

-- Aperçu avant confirmation : inscrits à prévenir, chevauchement du coach.
create function public.session_move_preview(p_session_id uuid, p_starts_at timestamptz)
returns table (booked integer, waitlisted integer, coach_conflict boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
begin
  select * into v_session from public.class_sessions where id = p_session_id;
  if not found then
    raise exception 'session_not_found';
  end if;
  if not private.is_gym_manager(v_session.gym_id) then
    raise exception 'forbidden';
  end if;

  return query
  select v_session.booked_count, v_session.waitlist_count,
    v_session.coach_id is not null and private.coach_has_conflict(
      v_session.coach_id,
      p_starts_at,
      p_starts_at + (v_session.ends_at - v_session.starts_at),
      v_session.id
    );
end;
$$;

create function public.move_session(p_session_id uuid, p_starts_at timestamptz)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
  v_old_label text;
  v_new_label text;
  v_duration interval;
begin
  select * into v_session from public.class_sessions where id = p_session_id for update;
  if not found then
    raise exception 'session_not_found';
  end if;
  if not private.is_gym_manager(v_session.gym_id) then
    raise exception 'forbidden';
  end if;
  if v_session.status <> 'scheduled' then
    raise exception 'session_cancelled';
  end if;
  if v_session.starts_at <= now() then
    raise exception 'session_started';
  end if;
  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'invalid_period';
  end if;
  if p_starts_at = v_session.starts_at then
    return v_session;
  end if;

  v_duration := v_session.ends_at - v_session.starts_at;
  v_old_label := private.session_label(v_session.id);

  update public.class_sessions
  set starts_at = p_starts_at, ends_at = p_starts_at + v_duration
  where id = v_session.id
  returning * into v_session;

  -- Créneau prévu du coach : suit la séance (base des heures).
  update public.coach_shifts
  set starts_at = v_session.starts_at, ends_at = v_session.ends_at
  where session_id = v_session.id and status = 'planned';

  v_new_label := private.session_label(v_session.id);
  perform private.notify_session_members(
    v_session.id,
    'session_moved',
    'Séance déplacée : ' || v_new_label,
    'La séance ' || v_old_label || ' est déplacée : nouveau créneau ' || v_new_label
      || '. Votre réservation est maintenue ; si le nouvel horaire ne vous convient pas, '
      || 'vous pouvez l''annuler depuis l''app, votre crédit vous sera rendu.'
  );
  return v_session;
end;
$$;

revoke all on function
  public.session_move_preview(uuid, timestamptz),
  public.move_session(uuid, timestamptz)
from public, anon;
grant execute on function
  public.session_move_preview(uuid, timestamptz),
  public.move_session(uuid, timestamptz)
to authenticated;
