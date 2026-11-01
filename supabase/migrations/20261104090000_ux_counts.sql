-- Revue UX avant la mise en dev (BRIEF §12, 2026-11-01) : trois comptes faussés.
--
-- 1. « Messages sans réponse » (crm_todo, pastille nav_counts) : un envoi automatique de la file
--    (séance annulée ou déplacée, campagne, automatisation, facturation) comptait comme une
--    réponse ; seul un message direct de l'équipe (origine `direct`) ou un échange saisi à la main
--    répond désormais à un adhérent.
-- 2. Pipeline (crm_pipeline) : la date d'activité d'une carte ignorait la même distinction ; un
--    avis automatique envoyé à toute la salle mettait toutes les cartes à « aujourd'hui ».
-- 3. Indicateurs (gym_kpis) : « Adhérents à risque » affichait la longueur d'une liste plafonnée à
--    10 ; `at_risk_count` donne le vrai nombre, la liste passe à 50 pour « Voir les N autres ».
--
-- Les fonctions sont reprises à l'identique, hors des lignes marquées par ces trois corrections.

-- Interaction journalisée par private.enqueue_message (source_ref 'outbound:<id>') pour un envoi
-- automatique. Un message direct de l'équipe (origine `direct`) reste une vraie réponse.
create function private.is_automatic_message(p_source_ref text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_source_ref like 'outbound:%' then exists (
      select 1 from public.outbound_messages o
      where o.id = substr(p_source_ref, 10)::uuid and o.origin <> 'direct'
    )
    else false
  end;
$$;

revoke all on function private.is_automatic_message(text) from public, anon;
-- crm_pipeline est security invoker : l'appelant doit pouvoir l'exécuter.
grant execute on function private.is_automatic_message(text) to authenticated;

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
      and not private.is_automatic_message(i.source_ref)
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
          and not private.is_automatic_message(i.source_ref)
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

create or replace function public.crm_pipeline(p_gym_id uuid, p_filters jsonb default null)
returns table (
  member_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  status public.member_status,
  stage text,
  bookings integer,
  last_activity_at timestamptz,
  tags text[],
  fields jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id, m.first_name, m.last_name, m.email, m.phone, m.status,
    case
      when m.status = 'prospect' and (coalesce(b.n, 0) > 0 or 'essai' = any (m.tags)) then 'trial'
      when m.status = 'prospect' then 'lead'
      else m.status::text
    end,
    coalesce(b.n, 0)::integer,
    greatest(m.created_at, b.last_at, i.last_at),
    m.tags,
    coalesce((
      select jsonb_object_agg(mf.key, v.value)
      from public.member_field_values v
      join public.member_fields mf on mf.id = v.field_id
      where v.member_id = m.id
    ), '{}'::jsonb)
  from public.members m
  left join lateral (
    select count(*) as n, max(s.starts_at) filter (where s.starts_at <= now()) as last_at
    from public.bookings bk
    join public.class_sessions s on s.id = bk.session_id
    where bk.member_id = m.id and bk.status <> 'cancelled'
  ) b on true
  left join lateral (
    select max(occurred_at) as last_at from public.interactions
    where member_id = m.id and not private.is_automatic_message(source_ref)
  ) i on true
  where m.gym_id = p_gym_id
    -- Filtres d'une vue : évalués une fois (sous-requête non corrélée), puis jointure par id.
    and (p_filters is null or m.id in (select fm.id from public.filter_members(p_gym_id, p_filters) fm))
  order by greatest(m.created_at, b.last_at, i.last_at) desc nulls last;
$$;

create or replace function private.gym_kpis_base(p_gym_id uuid, p_from date, p_to date)
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
        order by previous desc, last_at nulls first
        limit 50
      ) r
    ), '[]'::jsonb),
    -- Nombre réel : la liste ci-dessus est plafonnée (affichage), le compte ne l'est pas.
    'at_risk_count', (select count(*) from activity where previous >= v_min and recent * 2 <= previous),
    'coach_minutes', (select coalesce(sum(minutes), 0) from public.coach_hours(p_gym_id, p_from, p_to)),
    'coach_amount_cents', (select coalesce(sum(amount_cents), 0) from public.coach_hours(p_gym_id, p_from, p_to))
  ) into v_result;
  return v_result;
end;
$$;
