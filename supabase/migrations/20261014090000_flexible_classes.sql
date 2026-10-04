-- Paramétrage souple des cours (BRIEF §12, 2026-10-04) : plusieurs coachs par cours (chacun
-- payé la durée complète), durée et places modifiables par séance ou pour « cette séance et
-- les suivantes », séances ponctuelles, valeurs par défaut des disciplines.
--
-- session_coaches / template_coaches font foi. class_sessions.coach_id et
-- class_templates.default_coach_id restent le « coach principal » (position 0), tenus par
-- trigger : les versions publiées des apps continuent de les lire.

-- ---------------------------------------------------------------------------
-- Tables de liaison
-- ---------------------------------------------------------------------------

create table public.session_coaches (
  gym_id uuid not null,
  session_id uuid not null,
  coach_id uuid not null,
  position smallint not null default 0,
  primary key (session_id, coach_id),
  foreign key (session_id, gym_id) references public.class_sessions (id, gym_id) on delete cascade,
  foreign key (coach_id, gym_id) references public.coaches (id, gym_id)
);
create index session_coaches_coach_idx on public.session_coaches (coach_id, gym_id);
create index session_coaches_session_gym_idx on public.session_coaches (session_id, gym_id);

create table public.template_coaches (
  gym_id uuid not null,
  template_id uuid not null,
  coach_id uuid not null,
  position smallint not null default 0,
  primary key (template_id, coach_id),
  foreign key (template_id, gym_id) references public.class_templates (id, gym_id) on delete cascade,
  foreign key (coach_id, gym_id) references public.coaches (id, gym_id)
);
create index template_coaches_coach_idx on public.template_coaches (coach_id, gym_id);
create index template_coaches_template_gym_idx on public.template_coaches (template_id, gym_id);

alter table public.session_coaches enable row level security;
alter table public.template_coaches enable row level security;
revoke all on public.session_coaches, public.template_coaches from anon, authenticated;
grant select on public.session_coaches to anon, authenticated;
grant select on public.template_coaches to authenticated;

-- Comme class_sessions (planning public) et class_templates (équipe). Écriture : fonctions.
create policy "session_coaches_select_public" on public.session_coaches
  for select to anon, authenticated using (true);
create policy "template_coaches_select_team" on public.template_coaches
  for select to authenticated using (private.is_gym_team(gym_id));

-- Séance modifiée seule : « cette séance et les suivantes » ne l'écrase pas.
alter table public.class_sessions add column is_customized boolean not null default false;

-- Valeurs proposées à la création d'un cours de cette discipline.
alter table public.disciplines
  add column default_duration_minutes integer not null default 60
    check (default_duration_minutes between 15 and 240),
  add column default_capacity integer not null default 12
    check (default_capacity between 1 and 200);

-- Reprise : le coach existant devient le coach principal.
insert into public.session_coaches (gym_id, session_id, coach_id, position)
select gym_id, id, coach_id, 0 from public.class_sessions where coach_id is not null;
insert into public.template_coaches (gym_id, template_id, coach_id, position)
select gym_id, id, default_coach_id, 0 from public.class_templates where default_coach_id is not null;

-- ---------------------------------------------------------------------------
-- Synchronisation coach principal ⇄ tables de liaison
-- ---------------------------------------------------------------------------

-- Nouvelle séance : coachs du cours récurrent, sinon coach_id fourni.
create function private.class_sessions_init_coaches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.template_id is not null and exists (
    select 1 from public.template_coaches where template_id = new.template_id
  ) then
    insert into public.session_coaches (gym_id, session_id, coach_id, position)
    select new.gym_id, new.id, coach_id, position
    from public.template_coaches where template_id = new.template_id
    on conflict do nothing;
  elsif new.coach_id is not null then
    insert into public.session_coaches (gym_id, session_id, coach_id, position)
    values (new.gym_id, new.id, new.coach_id, 0)
    on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger class_sessions_init_coaches after insert on public.class_sessions
  for each row execute function private.class_sessions_init_coaches();

create function private.class_templates_init_coaches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.default_coach_id is not null then
    insert into public.template_coaches (gym_id, template_id, coach_id, position)
    values (new.gym_id, new.id, new.default_coach_id, 0)
    on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger class_templates_init_coaches after insert on public.class_templates
  for each row execute function private.class_templates_init_coaches();

-- Coach principal = première position.
create function private.session_coaches_sync_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid := coalesce(new.session_id, old.session_id);
begin
  update public.class_sessions s
  set coach_id = (
    select coach_id from public.session_coaches
    where session_id = v_session_id order by position, coach_id limit 1
  )
  where s.id = v_session_id;
  return null;
end;
$$;
create trigger session_coaches_sync_lead after insert or update or delete on public.session_coaches
  for each row execute function private.session_coaches_sync_lead();

create function private.template_coaches_sync_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template_id uuid := coalesce(new.template_id, old.template_id);
begin
  update public.class_templates t
  set default_coach_id = (
    select coach_id from public.template_coaches
    where template_id = v_template_id order by position, coach_id limit 1
  )
  where t.id = v_template_id;
  return null;
end;
$$;
create trigger template_coaches_sync_lead after insert or update or delete on public.template_coaches
  for each row execute function private.template_coaches_sync_lead();

-- ---------------------------------------------------------------------------
-- Règles d'accès et calculs : tous les coachs assignés
-- ---------------------------------------------------------------------------

create or replace function private.is_session_coach(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.session_coaches sc
    join public.coaches c on c.id = sc.coach_id
    where sc.session_id = p_session_id and c.profile_id = (select auth.uid())
  );
$$;

create or replace function private.is_member_of_my_classes(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings b
    join public.session_coaches sc on sc.session_id = b.session_id
    join public.coaches c on c.id = sc.coach_id
    where b.member_id = p_member_id and c.profile_id = (select auth.uid())
  );
$$;

create or replace function private.coach_has_conflict(
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
    select 1
    from public.session_coaches sc
    join public.class_sessions s on s.id = sc.session_id
    where sc.coach_id = p_coach_id
      and s.status = 'scheduled'
      and s.id is distinct from p_exclude_session_id
      and s.starts_at < p_ends
      and s.ends_at > p_starts
  );
$$;

create or replace function public.session_coach_options(p_session_id uuid)
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
    exists (select 1 from public.session_coaches sc where sc.session_id = v_session.id and sc.coach_id = c.id),
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

-- Heures réalisées : chaque coach assigné est payé la durée complète de la séance.
create or replace function public.coach_hours(p_gym_id uuid, p_from date, p_to date)
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
    select sc.coach_id,
           count(*)::integer as sessions,
           (sum(extract(epoch from s.ends_at - s.starts_at)) / 60)::integer as minutes
    from public.class_sessions s
    join public.session_coaches sc on sc.session_id = s.id
    cross join bounds b
    where s.gym_id = p_gym_id
      and s.status = 'scheduled'
      and s.ends_at <= now()
      and s.starts_at >= b.from_at
      and s.starts_at < b.to_at
    group by sc.coach_id
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

-- ---------------------------------------------------------------------------
-- Coachs d'une séance (créneaux coach_shifts tenus à jour, inscrits prévenus par l'appelant)
-- ---------------------------------------------------------------------------

-- Remplace la liste des coachs d'une séance (verrouillée par l'appelant). Renvoie vrai si
-- elle a changé.
create function private.set_session_coaches(p_session public.class_sessions, p_coach_ids uuid[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old uuid[];
  v_new uuid[];
  v_removed uuid[];
  v_added uuid[];
begin
  select coalesce(array_agg(coach_id order by position, coach_id), '{}') into v_old
  from public.session_coaches where session_id = p_session.id;
  -- Ordre conservé, doublons retirés.
  select coalesce(array_agg(id order by ord), '{}') into v_new
  from (
    select distinct on (id) id, ord
    from unnest(coalesce(p_coach_ids, '{}')) with ordinality as x(id, ord)
    order by id, ord
  ) d;
  if v_new = v_old then
    return false;
  end if;
  if exists (
    select 1 from unnest(v_new) as x(id)
    where not exists (
      select 1 from public.coaches c where c.id = x.id and c.gym_id = p_session.gym_id and c.is_active
    )
  ) then
    raise exception 'coach_not_found';
  end if;

  v_removed := array(select unnest(v_old) except select unnest(v_new));
  v_added := array(select unnest(v_new) except select unnest(v_old));

  delete from public.session_coaches where session_id = p_session.id;
  insert into public.session_coaches (gym_id, session_id, coach_id, position)
  select p_session.gym_id, p_session.id, id, (ord - 1)::smallint
  from unnest(v_new) with ordinality as x(id, ord);

  -- Créneaux (base des heures) : annulés pour les coachs retirés, créés pour les nouveaux.
  -- Un remplacement un pour un garde la trace du coach remplacé.
  update public.coach_shifts set status = 'cancelled'
  where session_id = p_session.id and status = 'planned' and coach_id = any (v_removed);
  insert into public.coach_shifts (gym_id, coach_id, session_id, replaced_coach_id, starts_at, ends_at, status)
  select p_session.gym_id, id, p_session.id,
    case when cardinality(v_removed) = 1 and cardinality(v_added) = 1 then v_removed[1] end,
    p_session.starts_at, p_session.ends_at, 'planned'
  from unnest(v_added) as x(id);
  return true;
end;
$$;

drop function public.replace_session_coach(uuid, uuid, text);

-- ---------------------------------------------------------------------------
-- Modifier une séance, ou « cette séance et les suivantes »
-- ---------------------------------------------------------------------------

-- Applique des changements à une séance verrouillée. Renvoie vrai si les inscrits doivent
-- être prévenus (horaire de fin ou coachs modifiés).
create function private.apply_session_changes(p_session public.class_sessions, p_changes jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity integer := coalesce((p_changes ->> 'capacity')::integer, p_session.capacity);
  v_duration integer;
  v_room_id uuid := p_session.room_id;
  v_room_capacity integer;
  v_notify boolean := false;
  v_ends timestamptz := p_session.ends_at;
begin
  if p_changes ? 'room_id' then
    v_room_id := nullif(p_changes ->> 'room_id', '')::uuid;
    if v_room_id is not null and not exists (
      select 1 from public.rooms where id = v_room_id and gym_id = p_session.gym_id
    ) then
      raise exception 'invalid_input';
    end if;
  end if;
  if p_changes ? 'discipline_id' and not exists (
    select 1 from public.disciplines
    where id = (p_changes ->> 'discipline_id')::uuid and gym_id = p_session.gym_id
  ) then
    raise exception 'invalid_input';
  end if;

  if v_capacity < 1 or v_capacity > 200 then
    raise exception 'invalid_input';
  end if;
  if v_capacity < p_session.booked_count then
    raise exception 'capacity_below_booked';
  end if;
  if v_room_id is not null then
    select capacity into v_room_capacity from public.rooms where id = v_room_id;
    if v_capacity > v_room_capacity then
      raise exception 'room_capacity_exceeded';
    end if;
  end if;

  if p_changes ? 'duration_minutes' then
    v_duration := (p_changes ->> 'duration_minutes')::integer;
    if v_duration is null or v_duration < 15 or v_duration > 240 or v_duration % 5 <> 0 then
      raise exception 'invalid_duration';
    end if;
    v_ends := p_session.starts_at + make_interval(mins => v_duration);
    v_notify := v_ends <> p_session.ends_at;
  end if;

  update public.class_sessions
  set capacity = v_capacity,
      ends_at = v_ends,
      room_id = v_room_id,
      discipline_id = coalesce((p_changes ->> 'discipline_id')::uuid, discipline_id)
  where id = p_session.id
  returning * into p_session;

  update public.coach_shifts set ends_at = v_ends
  where session_id = p_session.id and status = 'planned';

  if p_changes ? 'coach_ids' then
    if private.set_session_coaches(
      p_session,
      array(select jsonb_array_elements_text(p_changes -> 'coach_ids')::uuid)
    ) then
      v_notify := true;
    end if;
  end if;

  -- Places ajoutées : la liste d'attente en profite.
  perform private.promote_waitlist(p_session.id);
  return v_notify;
end;
$$;

-- Prévient les inscrits d'une séance modifiée (horaire de fin, coachs).
create function private.notify_session_changed(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text := private.session_label(p_session_id);
  v_end text;
  v_coaches text;
begin
  select to_char(s.ends_at at time zone g.timezone, 'FMHH24"h"MI'),
         (select string_agg(c.display_name, ', ' order by sc.position)
          from public.session_coaches sc join public.coaches c on c.id = sc.coach_id
          where sc.session_id = s.id)
  into v_end, v_coaches
  from public.class_sessions s join public.gyms g on g.id = s.gym_id
  where s.id = p_session_id;

  perform private.notify_session_members(
    p_session_id,
    'session_moved',
    'Séance modifiée : ' || v_label,
    'La séance ' || v_label || ' a été modifiée : fin à ' || replace(v_end, 'h00', 'h')
      || coalesce(', coachs : ' || v_coaches, '')
      || '. Votre réservation est maintenue ; vous pouvez l''annuler depuis l''app si besoin.'
  );
end;
$$;

-- Changements : capacity, duration_minutes, coach_ids (tableau), room_id (ou null),
-- discipline_id. p_scope : 'one' (séance seule, marquée personnalisée) ou 'following'
-- (cours récurrent et ses séances à venir non personnalisées, à partir de celle-ci).
-- Renvoie le nombre de séances modifiées.
create function public.update_session(p_session_id uuid, p_changes jsonb, p_scope text default 'one')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
  v_target public.class_sessions;
  v_count integer := 0;
begin
  select * into v_session from public.class_sessions where id = p_session_id;
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
  if p_scope not in ('one', 'following') or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'invalid_input';
  end if;

  if p_scope = 'one' or v_session.template_id is null then
    select * into v_target from public.class_sessions where id = p_session_id for update;
    if private.apply_session_changes(v_target, p_changes) and v_target.starts_at > now() then
      perform private.notify_session_changed(v_target.id);
    end if;
    update public.class_sessions set is_customized = (template_id is not null) where id = p_session_id;
    return 1;
  end if;

  -- Cours récurrent mis à jour, puis ses séances concernées (verrouillées dans l'ordre).
  perform private.apply_template_changes(v_session.template_id, p_changes);
  for v_target in
    select * from public.class_sessions
    where template_id = v_session.template_id
      and status = 'scheduled'
      and starts_at >= v_session.starts_at
      and (id = v_session.id or not is_customized)
    order by starts_at
    for update
  loop
    if private.apply_session_changes(v_target, p_changes) and v_target.starts_at > now() then
      perform private.notify_session_changed(v_target.id);
    end if;
    v_count := v_count + 1;
  end loop;
  update public.class_sessions set is_customized = false where id = p_session_id;
  return v_count;
end;
$$;

-- Champs du cours récurrent (sans toucher aux séances).
create function private.apply_template_changes(p_template_id uuid, p_changes jsonb)
returns public.class_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.class_templates;
  v_room_capacity integer;
begin
  select * into v_template from public.class_templates where id = p_template_id for update;
  update public.class_templates set
    capacity = coalesce((p_changes ->> 'capacity')::integer, capacity),
    duration_minutes = coalesce((p_changes ->> 'duration_minutes')::integer, duration_minutes),
    room_id = case when p_changes ? 'room_id' then nullif(p_changes ->> 'room_id', '')::uuid else room_id end,
    discipline_id = coalesce((p_changes ->> 'discipline_id')::uuid, discipline_id),
    weekday = coalesce((p_changes ->> 'weekday')::smallint, weekday),
    start_time = coalesce((p_changes ->> 'start_time')::time, start_time),
    starts_on = coalesce((p_changes ->> 'starts_on')::date, starts_on),
    ends_on = case when p_changes ? 'ends_on' then nullif(p_changes ->> 'ends_on', '')::date else ends_on end,
    is_active = coalesce((p_changes ->> 'is_active')::boolean, is_active)
  where id = p_template_id
  returning * into v_template;

  if v_template.duration_minutes < 15 or v_template.duration_minutes > 240
    or v_template.duration_minutes % 5 <> 0 then
    raise exception 'invalid_duration';
  end if;
  if v_template.capacity < 1 or v_template.capacity > 200
    or (v_template.ends_on is not null and v_template.ends_on < v_template.starts_on) then
    raise exception 'invalid_input';
  end if;
  if v_template.room_id is not null then
    select capacity into v_room_capacity from public.rooms
    where id = v_template.room_id and gym_id = v_template.gym_id;
    if v_room_capacity is null then
      raise exception 'invalid_input';
    end if;
    if v_template.capacity > v_room_capacity then
      raise exception 'room_capacity_exceeded';
    end if;
  end if;

  if p_changes ? 'coach_ids' then
    if exists (
      select 1 from jsonb_array_elements_text(p_changes -> 'coach_ids') as x(id)
      where not exists (
        select 1 from public.coaches c
        where c.id = x.id::uuid and c.gym_id = v_template.gym_id and c.is_active
      )
    ) then
      raise exception 'coach_not_found';
    end if;
    delete from public.template_coaches where template_id = p_template_id;
    insert into public.template_coaches (gym_id, template_id, coach_id, position)
    select v_template.gym_id, p_template_id, id::uuid, (min(ord) - 1)::smallint
    from jsonb_array_elements_text(p_changes -> 'coach_ids') with ordinality as x(id, ord)
    group by id;
  end if;
  return v_template;
end;
$$;

-- Édition d'un cours récurrent (liste des cours) : appliquée aux séances à venir non
-- personnalisées. Jour ou heure modifiés : les séances à venir sans réservation sont
-- régénérées au nouveau créneau, celles qui ont des réservations restent et deviennent
-- personnalisées.
create function public.update_template(p_template_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
  v_target public.class_sessions;
  v_updated integer := 0;
  v_kept integer := 0;
  v_regenerated integer := 0;
  v_session_changes jsonb;
begin
  select gym_id into v_gym_id from public.class_templates where id = p_template_id;
  if not found then
    raise exception 'session_not_found';
  end if;
  if not private.is_gym_manager(v_gym_id) then
    raise exception 'forbidden';
  end if;
  if jsonb_typeof(p_changes) <> 'object' then
    raise exception 'invalid_input';
  end if;

  perform private.apply_template_changes(p_template_id, p_changes);
  v_session_changes := p_changes - array['weekday', 'start_time', 'starts_on', 'ends_on', 'is_active'];

  if p_changes ?| array['weekday', 'start_time', 'starts_on', 'ends_on', 'is_active'] then
    -- Créneaux changés : séances futures sans inscrit supprimées puis régénérées.
    for v_target in
      select * from public.class_sessions
      where template_id = p_template_id and status = 'scheduled' and starts_at > now()
        and not is_customized
      order by starts_at
      for update
    loop
      -- Une séance qui a eu des réservations (même annulées) reste : historique et crédits.
      if exists (select 1 from public.bookings where session_id = v_target.id) then
        update public.class_sessions set is_customized = true where id = v_target.id;
        v_kept := v_kept + 1;
      else
        delete from public.coach_shifts where session_id = v_target.id;
        delete from public.class_sessions where id = v_target.id;
      end if;
    end loop;
    v_regenerated := private.generate_sessions_for(v_gym_id, current_date, current_date + 28);
  end if;

  if v_session_changes <> '{}'::jsonb then
    for v_target in
      select * from public.class_sessions
      where template_id = p_template_id and status = 'scheduled' and starts_at > now()
        and not is_customized
      order by starts_at
      for update
    loop
      if private.apply_session_changes(v_target, v_session_changes) then
        perform private.notify_session_changed(v_target.id);
      end if;
      v_updated := v_updated + 1;
    end loop;
  end if;

  return jsonb_build_object('updated', v_updated, 'kept', v_kept, 'regenerated', v_regenerated);
end;
$$;

-- Séance ponctuelle (hors cours récurrent).
create function public.create_session(
  p_gym_id uuid,
  p_discipline_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer default null,
  p_capacity integer default null,
  p_coach_ids uuid[] default '{}',
  p_room_id uuid default null
)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discipline public.disciplines;
  v_session public.class_sessions;
  v_duration integer;
  v_capacity integer;
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  select * into v_discipline from public.disciplines where id = p_discipline_id and gym_id = p_gym_id;
  if not found then
    raise exception 'invalid_input';
  end if;
  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'invalid_period';
  end if;
  v_duration := coalesce(p_duration_minutes, v_discipline.default_duration_minutes);
  v_capacity := coalesce(p_capacity, v_discipline.default_capacity);
  if v_duration < 15 or v_duration > 240 or v_duration % 5 <> 0 then
    raise exception 'invalid_duration';
  end if;

  insert into public.class_sessions (gym_id, discipline_id, starts_at, ends_at, capacity)
  values (p_gym_id, p_discipline_id, p_starts_at, p_starts_at + make_interval(mins => v_duration), v_capacity)
  returning * into v_session;
  perform private.apply_session_changes(
    v_session,
    jsonb_build_object('capacity', v_capacity, 'room_id', coalesce(p_room_id::text, ''),
                       'coach_ids', to_jsonb(coalesce(p_coach_ids, '{}')))
  );
  select * into v_session from public.class_sessions where id = v_session.id;
  return v_session;
end;
$$;

revoke all on function
  private.class_sessions_init_coaches(),
  private.class_templates_init_coaches(),
  private.session_coaches_sync_lead(),
  private.template_coaches_sync_lead(),
  private.set_session_coaches(public.class_sessions, uuid[]),
  private.apply_session_changes(public.class_sessions, jsonb),
  private.notify_session_changed(uuid),
  private.apply_template_changes(uuid, jsonb)
from public, anon, authenticated;

revoke all on function
  public.update_session(uuid, jsonb, text),
  public.update_template(uuid, jsonb),
  public.create_session(uuid, uuid, timestamptz, integer, integer, uuid[], uuid)
from public, anon;
grant execute on function
  public.update_session(uuid, jsonb, text),
  public.update_template(uuid, jsonb),
  public.create_session(uuid, uuid, timestamptz, integer, integer, uuid[], uuid)
to authenticated;
