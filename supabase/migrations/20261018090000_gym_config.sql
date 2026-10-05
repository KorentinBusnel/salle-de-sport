-- Salle paramétrable par le gérant (BRIEF §12, 2026-10-05) :
-- - identité (téléphone, email, logo) et horaires d'ouverture sur gyms, lisibles sans compte
--   comme le nom et l'adresse ; le fuseau et le slug ne sont plus modifiables par l'API ;
-- - réglages internes (seuils de suivi, accueil, plafond de crédits…) dans gym_private_settings,
--   lisibles par l'équipe seulement (gyms est lisible sans compte) ;
-- - jours de fermeture (gym_closures) : une alerte pour le gérant, les cours restent possibles ;
-- - update_gym_settings : fusion atomique des réglages, publics et internes ;
-- - logo dans le bucket public gym-assets, écrit par le gérant dans le dossier de sa salle ;
-- - crm_todo, nav_counts, adjust_credits et gym_kpis lisent leurs seuils dans les réglages
--   (mêmes valeurs par défaut qu'avant).

-- ---------------------------------------------------------------------------
-- Identité et horaires
-- ---------------------------------------------------------------------------

alter table public.gyms
  add column phone text check (phone is null or char_length(phone) <= 30),
  add column email text check (
    email is null or (char_length(email) <= 120 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  add column logo_path text check (logo_path is null or char_length(logo_path) <= 200),
  -- Plages par jour ISO (« 1 » = lundi) : {"1": [{"start": "07:00", "end": "21:00"}], …}.
  -- Validées par openingHoursSchema (packages/shared) ; vide : pas d'horaires saisis.
  add column opening_hours jsonb not null default '{}'::jsonb
    check (jsonb_typeof(opening_hours) = 'object'),
  add constraint gyms_name_length check (char_length(btrim(name)) between 1 and 80),
  add constraint gyms_address_length check (address is null or char_length(address) <= 200);

-- Le gérant modifie l'identité et les horaires ; réglages par update_gym_settings, fuseau et
-- slug figés.
revoke update on public.gyms from authenticated;
grant update (name, address, phone, email, logo_path, opening_hours) on public.gyms to authenticated;

-- ---------------------------------------------------------------------------
-- Réglages internes
-- ---------------------------------------------------------------------------

create table public.gym_private_settings (
  gym_id uuid primary key references public.gyms (id) on delete cascade,
  -- Miroir de gymPrivateSettingsSchema (packages/shared) ; valeur absente : défaut.
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.gym_private_settings enable row level security;
revoke all on public.gym_private_settings from anon, authenticated;
grant select on public.gym_private_settings to authenticated;

create policy "gym_private_settings_select_team" on public.gym_private_settings
  for select to authenticated
  using (private.is_gym_team(gym_id));

-- Entier d'un réglage interne, borné ; absent ou mal typé : défaut.
create function private.gym_private_int(
  p_gym_id uuid, p_key text, p_default integer, p_min integer, p_max integer
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case when jsonb_typeof(settings -> p_key) = 'number'
      then least(greatest(floor((settings ->> p_key)::numeric)::integer, p_min), p_max) end
    from public.gym_private_settings where gym_id = p_gym_id
  ), p_default);
$$;

revoke all on function private.gym_private_int(uuid, text, integer, integer, integer) from public, anon;
grant execute on function private.gym_private_int(uuid, text, integer, integer, integer) to authenticated;

-- Fusion atomique (jsonb ||) des réglages publics (gyms.settings) et internes ; une valeur
-- null retire la clé (retour au défaut). Les valeurs sont validées par le back office (Zod).
create function public.update_gym_settings(
  p_gym_id uuid, p_settings jsonb default '{}'::jsonb, p_private jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  if jsonb_typeof(coalesce(p_settings, '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_private, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid_settings';
  end if;

  if coalesce(p_settings, '{}'::jsonb) <> '{}'::jsonb then
    update public.gyms set settings = jsonb_strip_nulls(settings || p_settings)
    where id = p_gym_id;
  end if;
  if coalesce(p_private, '{}'::jsonb) <> '{}'::jsonb then
    insert into public.gym_private_settings (gym_id, settings)
    values (p_gym_id, jsonb_strip_nulls(p_private))
    on conflict (gym_id) do update
      -- p_private brut : ses null retirent les clés existantes.
      set settings = jsonb_strip_nulls(public.gym_private_settings.settings || p_private),
          updated_at = now();
  end if;
end;
$$;

revoke all on function public.update_gym_settings(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.update_gym_settings(uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Jours de fermeture
-- ---------------------------------------------------------------------------

create table public.gym_closures (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  day date not null,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (id, gym_id),
  unique (gym_id, day)
);

alter table public.gym_closures enable row level security;
revoke all on public.gym_closures from anon, authenticated;
grant select, insert, delete on public.gym_closures to authenticated;
grant update (label) on public.gym_closures to authenticated;

create policy "gym_closures_select_team" on public.gym_closures
  for select to authenticated
  using (private.is_gym_team(gym_id));
create policy "gym_closures_insert_manager" on public.gym_closures
  for insert to authenticated
  with check (private.is_gym_manager(gym_id));
create policy "gym_closures_update_manager" on public.gym_closures
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "gym_closures_delete_manager" on public.gym_closures
  for delete to authenticated
  using (private.is_gym_manager(gym_id));

-- ---------------------------------------------------------------------------
-- Logo : bucket public, écrit par le gérant dans « <gym_id>/… »
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gym-assets', 'gym-assets', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Salle du dossier racine d'un objet (null si ce n'est pas un identifiant).
create function private.storage_gym_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

revoke all on function private.storage_gym_id(text) from public, anon;
grant execute on function private.storage_gym_id(text) to authenticated;

create policy "gym_assets_select_manager" on storage.objects
  for select to authenticated
  using (bucket_id = 'gym-assets' and private.is_gym_manager(private.storage_gym_id(name)));
create policy "gym_assets_insert_manager" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gym-assets' and private.is_gym_manager(private.storage_gym_id(name)));
create policy "gym_assets_update_manager" on storage.objects
  for update to authenticated
  using (bucket_id = 'gym-assets' and private.is_gym_manager(private.storage_gym_id(name)))
  with check (bucket_id = 'gym-assets' and private.is_gym_manager(private.storage_gym_id(name)));
create policy "gym_assets_delete_manager" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gym-assets' and private.is_gym_manager(private.storage_gym_id(name)));

-- ---------------------------------------------------------------------------
-- Seuils lus dans les réglages (mêmes défauts qu'avant)
-- ---------------------------------------------------------------------------

-- Essais à rappeler : fenêtre réglable (7 jours) ; listes plafonnées par crm_list_limit (50).
create or replace function public.crm_todo(p_gym_id uuid)
returns table (kind text, total integer, member_ids uuid[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_trial_days integer := private.gym_private_int(p_gym_id, 'trial_followup_days', 7, 1, 60);
  v_limit integer := private.gym_private_int(p_gym_id, 'crm_list_limit', 50, 10, 200);
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;

  return query
  with incomplete as (
    select m.id, m.created_at as at from public.members m
    where m.gym_id = p_gym_id and m.status in ('active', 'prospect')
      and (m.email is null or m.phone is null)
  ),
  last_exchange as (
    select distinct on (i.member_id) i.member_id as id, i.direction, i.occurred_at as at
    from public.interactions i
    where i.gym_id = p_gym_id and i.member_id is not null
      and i.channel in ('email', 'whatsapp', 'phone') and i.direction in ('inbound', 'outbound')
    order by i.member_id, i.occurred_at desc
  ),
  unanswered as (select id, at from last_exchange where direction = 'inbound'),
  trials as (
    select m.id, max(s.starts_at) as at
    from public.members m
    join public.bookings b on b.member_id = m.id and b.status = 'attended'
    join public.class_sessions s on s.id = b.session_id
    where m.gym_id = p_gym_id and m.status = 'prospect' and s.starts_at > now() - make_interval(days => v_trial_days)
    group by m.id
  )
  select 'incomplete'::text, (select count(*)::integer from incomplete),
    coalesce((select array_agg(id order by at desc) from (select * from incomplete order by at desc limit v_limit) x), '{}')
  union all
  select 'unanswered', (select count(*)::integer from unanswered),
    coalesce((select array_agg(id order by at) from (select * from unanswered order by at limit v_limit) x), '{}')
  union all
  select 'trials_to_call', (select count(*)::integer from trials),
    coalesce((select array_agg(id order by at desc) from (select * from trials order by at desc limit v_limit) x), '{}');
end;
$$;

-- Pastille « essais à rappeler » : même fenêtre que crm_todo.
create or replace function public.nav_counts(p_gym_id uuid)
returns table (prospects integer, unanswered integer, trials_to_call integer, unpaid integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_staff boolean := private.is_gym_staff(p_gym_id);
  v_manager boolean := private.is_gym_manager(p_gym_id);
  v_trial_days integer := private.gym_private_int(p_gym_id, 'trial_followup_days', 7, 1, 60);
begin
  if not private.is_gym_team(p_gym_id) then
    raise exception 'forbidden';
  end if;

  return query
  select
    case when v_staff then (
      select count(*)::integer from public.members m
      where m.gym_id = p_gym_id and m.status = 'prospect'
    ) end,
    case when v_manager then (
      select count(*)::integer from (
        select distinct on (i.member_id) i.direction
        from public.interactions i
        where i.gym_id = p_gym_id and i.member_id is not null
          and i.channel in ('email', 'whatsapp', 'phone') and i.direction in ('inbound', 'outbound')
        order by i.member_id, i.occurred_at desc
      ) last_exchange
      where last_exchange.direction = 'inbound'
    ) end,
    case when v_manager then (
      select count(distinct m.id)::integer
      from public.members m
      join public.bookings b on b.member_id = m.id and b.status = 'attended'
      join public.class_sessions s on s.id = b.session_id
      where m.gym_id = p_gym_id and m.status = 'prospect' and s.starts_at > now() - make_interval(days => v_trial_days)
    ) end,
    case when v_manager then (select count(*)::integer from public.unpaid_members(p_gym_id)) end;
end;
$$;

-- Ajout ou retrait de crédits : plafond réglable (50).
create or replace function public.adjust_credits(p_member_id uuid, p_delta integer, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  -- Verrou sur la fiche : deux retraits simultanés ne passent pas sous zéro.
  select * into v_member from public.members where id = p_member_id for update;
  if not found then
    raise exception 'member_not_found';
  end if;
  if not private.is_gym_manager(v_member.gym_id) then
    raise exception 'forbidden';
  end if;
  if p_delta is null or p_delta = 0
    or abs(p_delta) > private.gym_private_int(v_member.gym_id, 'credit_adjust_max', 50, 1, 500) then
    raise exception 'invalid_amount';
  end if;
  if p_delta < 0 then
    if not private.gym_setting_bool(v_member.gym_id, 'manager_can_remove_credits') then
      raise exception 'strategy_disabled';
    end if;
    if v_note is null then
      raise exception 'reason_required';
    end if;
    if private.credit_balance(v_member.id) + p_delta < 0 then
      raise exception 'insufficient_credits';
    end if;
  end if;

  insert into public.credit_ledger (gym_id, member_id, delta, reason, note, created_by)
  values (v_member.gym_id, v_member.id, p_delta, 'manual_adjustment',
          coalesce(v_note, 'Ajout manuel (back office)'), (select auth.uid()));
  return private.credit_balance(v_member.id);
end;
$$;

-- Adhérents « à risque » : fenêtre (30 jours) et minimum de séances (2) réglables.
create or replace function public.gym_kpis(p_gym_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
  v_window interval := make_interval(days => private.gym_private_int(p_gym_id, 'risk_window_days', 30, 7, 120));
  v_min integer := private.gym_private_int(p_gym_id, 'risk_min_sessions', 2, 1, 20);
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid_period';
  end if;
  select timezone into v_tz from public.gyms where id = p_gym_id;
  v_from := p_from::timestamp at time zone v_tz;
  v_to := (p_to + 1)::timestamp at time zone v_tz;

  with sessions as (
    select s.*,
      (select count(*) from public.bookings b
       where b.session_id = s.id and b.status in ('confirmed', 'attended', 'no_show')) as seats
    from public.class_sessions s
    where s.gym_id = p_gym_id and s.status = 'scheduled'
      and s.starts_at >= v_from and s.starts_at < v_to and s.starts_at <= now()
  ),
  new_members as (
    select m.status from public.members m
    where m.gym_id = p_gym_id and m.created_at >= v_from and m.created_at < v_to
  ),
  attendance as (
    select b.status from public.bookings b join sessions s on s.id = b.session_id
    where b.status in ('attended', 'no_show') and s.ends_at <= now()
  ),
  activity as (
    -- Séances suivies (ou réservées et passées) sur la fenêtre réglée (30 jours) et celle d'avant.
    select m.id, m.first_name, m.last_name,
      count(*) filter (where s.starts_at > now() - v_window) as recent,
      count(*) filter (where s.starts_at <= now() - v_window and s.starts_at > now() - 2 * v_window) as previous,
      max(s.starts_at) as last_at
    from public.members m
    left join public.bookings b on b.member_id = m.id and b.status in ('confirmed', 'attended', 'no_show')
    left join public.class_sessions s on s.id = b.session_id and s.starts_at <= now() and s.starts_at > now() - 2 * v_window
    where m.gym_id = p_gym_id and m.status = 'active'
    group by m.id
  )
  select jsonb_build_object(
    'new_members', (select count(*) from new_members),
    'new_members_active', (select count(*) from new_members where status = 'active'),
    'sessions', (select count(*) from sessions),
    'seats', (select coalesce(sum(seats), 0) from sessions),
    'capacity', (select coalesce(sum(capacity), 0) from sessions),
    'attended', (select count(*) from attendance where status = 'attended'),
    'no_show', (select count(*) from attendance where status = 'no_show'),
    'by_discipline', coalesce((
      select jsonb_agg(x order by x ->> 'name') from (
        select jsonb_build_object('name', d.name, 'color', d.color, 'sessions', count(*),
          'seats', sum(s.seats), 'capacity', sum(s.capacity)) as x
        from sessions s join public.disciplines d on d.id = s.discipline_id
        group by d.name, d.color
      ) t
    ), '[]'::jsonb),
    'heatmap', coalesce((
      select jsonb_agg(jsonb_build_object('weekday', wd, 'hour', hr, 'seats', seats, 'capacity', capacity))
      from (
        select extract(isodow from s.starts_at at time zone v_tz)::integer as wd,
               extract(hour from s.starts_at at time zone v_tz)::integer as hr,
               sum(s.seats) as seats, sum(s.capacity) as capacity
        from sessions s group by 1, 2
      ) h
    ), '[]'::jsonb),
    'at_risk', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', first_name || ' ' || last_name,
        'recent', recent, 'previous', previous, 'last_at', last_at) order by previous desc, last_at nulls first)
      from (
        select * from activity
        where previous >= v_min and recent * 2 <= previous
        order by previous desc
        limit 10
      ) r
    ), '[]'::jsonb),
    'coach_minutes', (select coalesce(sum(minutes), 0) from public.coach_hours(p_gym_id, p_from, p_to)),
    'coach_amount_cents', (select coalesce(sum(amount_cents), 0) from public.coach_hours(p_gym_id, p_from, p_to))
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ordre des disciplines (catalogue : « Monter / Descendre »)
-- ---------------------------------------------------------------------------

alter table public.disciplines add column position integer not null default 0;

-- Ordre initial : alphabétique, comme jusqu'ici.
update public.disciplines d set position = r.rank
from (
  select id, (row_number() over (partition by gym_id order by name) - 1)::integer as rank
  from public.disciplines
) r
where r.id = d.id;

-- Une nouvelle discipline arrive en dernier.
create function private.discipline_position_last()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.position := coalesce(
    (select max(d.position) + 1 from public.disciplines d where d.gym_id = new.gym_id), 0);
  return new;
end;
$$;

create trigger disciplines_position_last before insert on public.disciplines
  for each row execute function private.discipline_position_last();

-- Nouvel ordre (identifiants dans l'ordre voulu) ; les disciplines d'une autre salle sont ignorées.
create function public.reorder_disciplines(p_gym_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  update public.disciplines d set position = (x.ord - 1)::integer
  from unnest(p_ids) with ordinality as x(id, ord)
  where d.id = x.id and d.gym_id = p_gym_id;
end;
$$;

revoke all on function public.reorder_disciplines(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_disciplines(uuid, uuid[]) to authenticated;
