-- Indicateurs du back office (gym_kpis) et gestion de l'équipe (rôles par email).

-- ---------------------------------------------------------------------------
-- Équipe
-- ---------------------------------------------------------------------------

-- Membres de l'équipe (rôles autres qu'adhérent), avec leur email de connexion (gérant).
create function public.team_members(p_gym_id uuid)
returns table (
  profile_id uuid,
  first_name text,
  last_name text,
  email text,
  roles public.gym_role[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  return query
  select p.id, p.first_name, p.last_name, u.email::text,
         array_agg(r.role order by r.role)
  from public.gym_roles r
  join public.profiles p on p.id = r.profile_id
  join auth.users u on u.id = p.id
  where r.gym_id = p_gym_id and r.role <> 'member'
  group by p.id, p.first_name, p.last_name, u.email
  order by p.last_name, p.first_name;
end;
$$;

-- Ajoute un rôle d'équipe à un compte existant, retrouvé par son email. Les droits suivent la
-- RLS de gym_roles (gérant ; rôle admin par un admin seulement). Un coach reçoit sa fiche.
create function public.add_team_role(p_gym_id uuid, p_email text, p_role public.gym_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  if p_role = 'member' then
    raise exception 'invalid_input';
  end if;
  if p_role = 'admin' and not private.has_gym_role(p_gym_id, array['admin']::public.gym_role[]) then
    raise exception 'forbidden';
  end if;

  select p.* into v_profile
  from public.profiles p join auth.users u on u.id = p.id
  where lower(u.email) = lower(btrim(p_email));
  if not found then
    raise exception 'account_not_found';
  end if;

  insert into public.gym_roles (gym_id, profile_id, role)
  values (p_gym_id, v_profile.id, p_role)
  on conflict (gym_id, profile_id, role) do nothing;

  if p_role = 'coach' then
    insert into public.coaches (gym_id, profile_id, display_name)
    values (
      p_gym_id, v_profile.id,
      coalesce(nullif(btrim(coalesce(v_profile.first_name, '') || ' ' || left(coalesce(v_profile.last_name, ''), 1) || '.'), '.'), btrim(p_email))
    )
    on conflict (gym_id, profile_id) do nothing;
  end if;
  return v_profile.id;
end;
$$;

-- Retire un rôle d'équipe. Pas son propre rôle de gérant ou d'admin (éviter de se bloquer).
create function public.remove_team_role(p_gym_id uuid, p_profile_id uuid, p_role public.gym_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  if p_role = 'member' then
    raise exception 'invalid_input';
  end if;
  if p_role = 'admin' and not private.has_gym_role(p_gym_id, array['admin']::public.gym_role[]) then
    raise exception 'forbidden';
  end if;
  if p_profile_id = (select auth.uid()) and p_role in ('manager', 'admin') then
    raise exception 'cannot_remove_self';
  end if;
  delete from public.gym_roles
  where gym_id = p_gym_id and profile_id = p_profile_id and role = p_role;
end;
$$;

-- ---------------------------------------------------------------------------
-- Indicateurs : période [p_from, p_to] en dates civiles de la salle
-- ---------------------------------------------------------------------------

create function public.gym_kpis(p_gym_id uuid, p_from date, p_to date)
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
    -- Séances suivies (ou réservées et passées) sur les 30 derniers jours et les 30 d'avant.
    select m.id, m.first_name, m.last_name,
      count(*) filter (where s.starts_at > now() - interval '30 days') as recent,
      count(*) filter (where s.starts_at <= now() - interval '30 days' and s.starts_at > now() - interval '60 days') as previous,
      max(s.starts_at) as last_at
    from public.members m
    left join public.bookings b on b.member_id = m.id and b.status in ('confirmed', 'attended', 'no_show')
    left join public.class_sessions s on s.id = b.session_id and s.starts_at <= now() and s.starts_at > now() - interval '60 days'
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
        where previous >= 2 and recent * 2 <= previous
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

revoke all on function
  public.team_members(uuid),
  public.add_team_role(uuid, text, public.gym_role),
  public.remove_team_role(uuid, uuid, public.gym_role),
  public.gym_kpis(uuid, date, date)
from public, anon;
grant execute on function
  public.team_members(uuid),
  public.add_team_role(uuid, text, public.gym_role),
  public.remove_team_role(uuid, uuid, public.gym_role),
  public.gym_kpis(uuid, date, date)
to authenticated;
