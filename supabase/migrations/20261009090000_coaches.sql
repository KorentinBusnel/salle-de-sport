-- Coachs (back office complet) : remplacement d'un coach sur une séance, coachs disponibles
-- sur un créneau, heures réalisées (coachs freelances : base de leurs factures, BRIEF §12).

-- ---------------------------------------------------------------------------
-- Disponibilité d'un coach sur un créneau
-- ---------------------------------------------------------------------------

-- Le créneau [p_starts, p_ends) tient-il dans une disponibilité hebdomadaire du coach
-- (heure locale de la salle, période de validité) ?
create function private.coach_is_available(p_coach_id uuid, p_starts timestamptz, p_ends timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.coach_availabilities a
    join public.gyms g on g.id = a.gym_id
    cross join lateral (
      select (p_starts at time zone g.timezone) as local_start,
             (p_ends at time zone g.timezone) as local_end
    ) l
    where a.coach_id = p_coach_id
      and a.weekday = extract(isodow from l.local_start)
      and l.local_start::date = l.local_end::date
      and a.start_time <= l.local_start::time
      and a.end_time >= l.local_end::time
      and a.valid_from <= l.local_start::date
      and (a.valid_until is null or a.valid_until >= l.local_start::date)
  );
$$;

-- Le coach anime-t-il déjà une autre séance qui chevauche ce créneau ?
create function private.coach_has_conflict(
  p_coach_id uuid,
  p_starts timestamptz,
  p_ends timestamptz,
  p_exclude_session_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_sessions s
    where s.coach_id = p_coach_id
      and s.status = 'scheduled'
      and s.id is distinct from p_exclude_session_id
      and s.starts_at < p_ends
      and s.ends_at > p_starts
  );
$$;

revoke all on function
  private.coach_is_available(uuid, timestamptz, timestamptz),
  private.coach_has_conflict(uuid, timestamptz, timestamptz, uuid)
from public, anon, authenticated;

-- Coachs actifs de la salle pour une séance : disponibilité, conflit, discipline maîtrisée.
-- Accueil et gérant (choix d'un remplaçant).
create function public.session_coach_options(p_session_id uuid)
returns table (
  coach_id uuid,
  display_name text,
  is_current boolean,
  available boolean,
  has_conflict boolean,
  teaches_discipline boolean
)
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
  if not private.is_gym_staff(v_session.gym_id) then
    raise exception 'forbidden';
  end if;

  return query
  select
    c.id,
    c.display_name,
    c.id is not distinct from v_session.coach_id,
    private.coach_is_available(c.id, v_session.starts_at, v_session.ends_at),
    private.coach_has_conflict(c.id, v_session.starts_at, v_session.ends_at, v_session.id),
    exists (
      select 1 from public.coach_disciplines cd
      where cd.coach_id = c.id and cd.discipline_id = v_session.discipline_id
    )
  from public.coaches c
  where c.gym_id = v_session.gym_id and c.is_active
  order by c.display_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Remplacement d'un coach (gérant) : tracé dans coach_shifts, inscrits prévenus
-- ---------------------------------------------------------------------------

create function public.replace_session_coach(
  p_session_id uuid,
  p_coach_id uuid,
  p_note text default null
)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
  v_coach public.coaches;
  v_previous uuid;
  v_label text;
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
  if v_session.ends_at <= now() then
    raise exception 'session_ended';
  end if;

  select * into v_coach from public.coaches
  where id = p_coach_id and gym_id = v_session.gym_id and is_active;
  if not found then
    raise exception 'coach_not_found';
  end if;
  if v_session.coach_id is not distinct from v_coach.id then
    raise exception 'same_coach';
  end if;

  v_previous := v_session.coach_id;

  -- Créneau prévu du coach remplacé : annulé ; le remplaçant reçoit le sien.
  update public.coach_shifts
  set status = 'cancelled'
  where session_id = v_session.id and status = 'planned';
  insert into public.coach_shifts
    (gym_id, coach_id, session_id, replaced_coach_id, starts_at, ends_at, status, note)
  values
    (v_session.gym_id, v_coach.id, v_session.id, v_previous, v_session.starts_at,
     v_session.ends_at, 'planned', nullif(btrim(coalesce(p_note, '')), ''));

  update public.class_sessions set coach_id = v_coach.id where id = v_session.id
  returning * into v_session;

  v_label := private.session_label(v_session.id);
  perform private.notify_session_members(
    v_session.id,
    'coach_changed',
    'Changement de coach : ' || v_label,
    'La séance ' || v_label || ' sera encadrée par ' || v_coach.display_name
      || '. Votre réservation est maintenue.'
  );
  return v_session;
end;
$$;

-- ---------------------------------------------------------------------------
-- Heures réalisées : séances tenues (non annulées, terminées) × durée × taux horaire
-- ---------------------------------------------------------------------------

-- Période [p_from, p_to] en dates civiles de la salle. Le gérant voit tous les coachs,
-- un coach seulement lui-même (taux et montant compris, comme coach_compensations).
create function public.coach_hours(p_gym_id uuid, p_from date, p_to date)
returns table (
  coach_id uuid,
  display_name text,
  sessions integer,
  minutes integer,
  hourly_rate_cents integer,
  amount_cents bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select (p_from::timestamp at time zone g.timezone) as from_at,
           ((p_to + 1)::timestamp at time zone g.timezone) as to_at
    from public.gyms g where g.id = p_gym_id
  ),
  held as (
    select s.coach_id,
           count(*)::integer as sessions,
           (sum(extract(epoch from s.ends_at - s.starts_at)) / 60)::integer as minutes
    from public.class_sessions s, bounds b
    where s.gym_id = p_gym_id
      and s.status = 'scheduled'
      and s.coach_id is not null
      and s.ends_at <= now()
      and s.starts_at >= b.from_at
      and s.starts_at < b.to_at
    group by s.coach_id
  )
  select c.id, c.display_name,
         coalesce(h.sessions, 0), coalesce(h.minutes, 0),
         cc.hourly_rate_cents,
         case when cc.hourly_rate_cents is null then null
              else round(coalesce(h.minutes, 0) * cc.hourly_rate_cents / 60.0)::bigint end
  from public.coaches c
  left join held h on h.coach_id = c.id
  left join public.coach_compensations cc on cc.coach_id = c.id
  where c.gym_id = p_gym_id
    and (c.is_active or h.sessions is not null)
    and (private.is_gym_manager(p_gym_id) or private.is_own_coach(c.id))
  order by c.display_name;
$$;

revoke all on function
  public.session_coach_options(uuid),
  public.replace_session_coach(uuid, uuid, text),
  public.coach_hours(uuid, date, date)
from public, anon;
grant execute on function
  public.session_coach_options(uuid),
  public.replace_session_coach(uuid, uuid, text),
  public.coach_hours(uuid, date, date)
to authenticated;
