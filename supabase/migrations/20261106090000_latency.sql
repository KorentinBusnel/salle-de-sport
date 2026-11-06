-- Latence (BRIEF §12, 2026-11-06) : deux lectures qui pesaient sur chaque affichage.
--
-- 1. Envois automatiques. La règle du 2026-11-01 reste la même (toute origine sauf `direct` ne
--    vaut pas réponse à un adhérent), mais `private.is_automatic_message(source_ref)` était
--    appelée pour chaque ligne d'interaction : `crm_pipeline` mettait 290 ms pour 150 adhérents
--    au seed, `nav_counts` et `crm_todo` suivaient le même chemin à chaque page.
--    `private.automatic_refs(gym)` renvoie en une fois les références des envois automatiques
--    de la salle ; les trois fonctions l'interrogent par `not exists`, que le planificateur
--    exécute une seule fois par requête (sous-plan haché). Une seule définition de la règle.
-- 2. `member_status_counts(gym)` : les quatre comptes des onglets d'Adhérents en une lecture,
--    au lieu de quatre `count` séparés sous RLS (4 × 27 ms au seed).

create function private.automatic_refs(p_gym_id uuid)
returns table (ref text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'outbound:' || o.id::text
  from public.outbound_messages o
  where o.gym_id = p_gym_id and o.origin <> 'direct';
$$;

revoke all on function private.automatic_refs(uuid) from public, anon;
-- crm_pipeline est security invoker : l'appelant doit pouvoir l'exécuter.
grant execute on function private.automatic_refs(uuid) to authenticated;

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
  with automatic as materialized (
    select a.ref from private.automatic_refs(p_gym_id) a
  ),
  incomplete as (
    select m.id, m.created_at as at from public.members m
    where m.gym_id = p_gym_id and m.status in ('active', 'prospect')
      and (m.email is null or m.phone is null)
  ),
  last_exchange as (
    select distinct on (i.member_id) i.member_id as id, i.direction, i.occurred_at as at
    from public.interactions i
    where i.gym_id = p_gym_id and i.member_id is not null
      and i.channel in ('email', 'whatsapp', 'phone') and i.direction in ('inbound', 'outbound')
      and not exists (select 1 from automatic a where a.ref = i.source_ref)
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
          and not exists (select 1 from private.automatic_refs(p_gym_id) a where a.ref = i.source_ref)
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

-- Le Pipeline est au gérant : la fonction passe en security definer avec cette garde. En security
-- invoker, la RLS de `bookings` appelait ses fonctions de droits pour chacune des ~4 000
-- réservations de la salle (290 ms au seed) ; le `where m.gym_id = p_gym_id` est la barrière.
-- Dernier échange humain par adhérent calculé une fois (CTE), au lieu d'une sous-requête latérale
-- appelant une fonction par ligne.
drop function public.crm_pipeline(uuid, jsonb);

create function public.crm_pipeline(p_gym_id uuid, p_filters jsonb default null)
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
  with automatic as materialized (
    select a.ref from private.automatic_refs(p_gym_id) a
  ),
  exchanges as (
    select i.member_id, max(i.occurred_at) as last_at
    from public.interactions i
    where i.gym_id = p_gym_id and i.member_id is not null
      and not exists (select 1 from automatic a where a.ref = i.source_ref)
    group by i.member_id
  )
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
  left join exchanges i on i.member_id = m.id
  where m.gym_id = p_gym_id
    -- Filtres d'une vue : évalués une fois (sous-requête non corrélée), puis jointure par id.
    and (p_filters is null or m.id in (select fm.id from public.filter_members(p_gym_id, p_filters) fm))
  order by greatest(m.created_at, b.last_at, i.last_at) desc nulls last;
end;
$$;

revoke all on function public.crm_pipeline(uuid, jsonb) from public, anon;
grant execute on function public.crm_pipeline(uuid, jsonb) to authenticated;

-- Plus aucun appelant : la règle vit dans private.automatic_refs.
drop function private.is_automatic_message(text);

-- Comptes par statut des onglets d'Adhérents (accueil et gérant), tous les statuts, à zéro si vide.
create function public.member_status_counts(p_gym_id uuid)
returns table (status public.member_status, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_gym_staff(p_gym_id) then
    raise exception 'forbidden';
  end if;

  return query
  select s.status, coalesce(c.total, 0)::integer
  from unnest(enum_range(null::public.member_status)) as s(status)
  left join (
    select m.status, count(*) as total
    from public.members m
    where m.gym_id = p_gym_id
    group by m.status
  ) c on c.status = s.status
  order by s.status;
end;
$$;

revoke all on function public.member_status_counts(uuid) from public, anon;
grant execute on function public.member_status_counts(uuid) to authenticated;
