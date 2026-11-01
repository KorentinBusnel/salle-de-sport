-- Kanban paramétrable (BRIEF §12, 2026-11-01) : le pipeline accepte les filtres d'une vue
-- (mêmes clés que les segments, dont les champs personnalisés) et renvoie les étiquettes et les
-- valeurs des champs, pour grouper les cartes par étape ou par un champ liste côté application.
--
-- Une seule signature (drop puis create) : deux surcharges rendraient l'appel PostgREST ambigu.
-- security invoker : la RLS de members et de member_field_values s'applique (fields = {} sans
-- droit de lecture des valeurs).

drop function public.crm_pipeline(uuid);

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
    select max(occurred_at) as last_at from public.interactions where member_id = m.id
  ) i on true
  where m.gym_id = p_gym_id
    -- Filtres d'une vue : évalués une fois (sous-requête non corrélée), puis jointure par id.
    and (p_filters is null or m.id in (select fm.id from public.filter_members(p_gym_id, p_filters) fm))
  order by greatest(m.created_at, b.last_at, i.last_at) desc nulls last;
$$;

revoke all on function public.crm_pipeline(uuid, jsonb) from public, anon;
grant execute on function public.crm_pipeline(uuid, jsonb) to authenticated;
