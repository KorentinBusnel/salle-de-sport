-- CRM (back office complet) : segments dynamiques, pipeline déduit des données, filtre par
-- tag dans la recherche d'adhérents.

-- ---------------------------------------------------------------------------
-- Segments : filtres JSON (schéma segmentFiltersSchema de packages/shared)
-- ---------------------------------------------------------------------------

create table public.segments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  name text not null check (length(btrim(name)) between 1 and 80),
  filters jsonb not null default '{}' check (jsonb_typeof(filters) = 'object'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id)
);
create index segments_gym_id_idx on public.segments (gym_id);
create index segments_created_by_idx on public.segments (created_by);
create trigger segments_set_updated_at before update on public.segments
  for each row execute function private.set_updated_at();

alter table public.segments enable row level security;
revoke all on public.segments from anon, authenticated;
grant select, insert, update, delete on public.segments to authenticated;

create policy "segments_select_manager" on public.segments
  for select to authenticated using (private.is_gym_manager(gym_id));
create policy "segments_insert_manager" on public.segments
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "segments_update_manager" on public.segments
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "segments_delete_manager" on public.segments
  for delete to authenticated using (private.is_gym_manager(gym_id));

-- Dernière séance réservée (non annulée) déjà commencée : base de « l'inactivité ».
create function private.member_last_session_at(p_member_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(s.starts_at)
  from public.bookings b
  join public.class_sessions s on s.id = b.session_id
  where b.member_id = p_member_id
    and b.status in ('confirmed', 'attended', 'no_show')
    and s.starts_at <= now();
$$;
revoke all on function private.member_last_session_at(uuid) from public, anon;
grant execute on function private.member_last_session_at(uuid) to authenticated;

-- Fiches de la salle qui satisfont les filtres (tous combinés en ET). Droits de l'appelant :
-- la RLS s'applique (le solde de crédits n'est visible que des finances).
--   statuses        ["active", …]        statut parmi la liste
--   tags            ["blessure", …]      au moins un de ces tags
--   inactive_days   14                   aucune séance depuis N jours (ni à venir)
--   discipline_id   uuid                 a déjà réservé cette discipline
--   max_credits     2                    solde de crédits ≤ N
--   joined_since    "2026-09-01"         fiche créée depuis cette date
--   birthday_month  true                 anniversaire ce mois-ci (profil)
--   email_consent   true                 consentement marketing email
create function public.filter_members(p_gym_id uuid, p_filters jsonb)
returns setof public.members
language sql
stable
security invoker
set search_path = ''
as $$
  select m.*
  from public.members m
  join public.gyms g on g.id = m.gym_id
  where m.gym_id = p_gym_id
    and (
      jsonb_typeof(p_filters -> 'statuses') is distinct from 'array'
      or jsonb_array_length(p_filters -> 'statuses') = 0
      or m.status::text in (select jsonb_array_elements_text(p_filters -> 'statuses'))
    )
    and (
      jsonb_typeof(p_filters -> 'tags') is distinct from 'array'
      or jsonb_array_length(p_filters -> 'tags') = 0
      or m.tags && array(select jsonb_array_elements_text(p_filters -> 'tags'))
    )
    and (
      jsonb_typeof(p_filters -> 'inactive_days') is distinct from 'number'
      or (
        coalesce(private.member_last_session_at(m.id), m.created_at)
          < now() - make_interval(days => (p_filters ->> 'inactive_days')::integer)
        and not exists (
          select 1 from public.bookings b
          join public.class_sessions s on s.id = b.session_id
          where b.member_id = m.id and b.status in ('confirmed', 'waitlisted') and s.starts_at > now()
        )
      )
    )
    and (
      jsonb_typeof(p_filters -> 'discipline_id') is distinct from 'string'
      or exists (
        select 1 from public.bookings b
        join public.class_sessions s on s.id = b.session_id
        where b.member_id = m.id
          and b.status <> 'cancelled'
          and s.discipline_id::text = p_filters ->> 'discipline_id'
      )
    )
    and (
      jsonb_typeof(p_filters -> 'max_credits') is distinct from 'number'
      or (select coalesce(sum(l.delta), 0) from public.credit_ledger l where l.member_id = m.id)
        <= (p_filters ->> 'max_credits')::integer
    )
    and (
      jsonb_typeof(p_filters -> 'joined_since') is distinct from 'string'
      or m.created_at >= ((p_filters ->> 'joined_since')::date::timestamp at time zone g.timezone)
    )
    and (
      (p_filters -> 'birthday_month') is distinct from 'true'::jsonb
      or exists (
        select 1 from public.profiles p
        where p.id = m.profile_id
          and extract(month from p.birth_date) = extract(month from now() at time zone g.timezone)
      )
    )
    and (
      (p_filters -> 'email_consent') is distinct from 'true'::jsonb
      or (m.marketing_email_consent_at is not null and m.email is not null)
    )
  order by m.last_name, m.first_name, m.id;
$$;

-- Membres d'un segment enregistré.
create function public.segment_members(p_segment_id uuid)
returns setof public.members
language sql
stable
security invoker
set search_path = ''
as $$
  select f.*
  from public.segments s
  cross join lateral public.filter_members(s.gym_id, s.filters) f
  where s.id = p_segment_id;
$$;

-- ---------------------------------------------------------------------------
-- Pipeline : étape déduite du statut, des réservations et du tag « essai »
-- ---------------------------------------------------------------------------

create function public.crm_pipeline(p_gym_id uuid)
returns table (
  member_id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  status public.member_status,
  stage text,
  bookings integer,
  last_activity_at timestamptz
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
    greatest(m.created_at, b.last_at, i.last_at)
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
  order by greatest(m.created_at, b.last_at, i.last_at) desc nulls last;
$$;

-- ---------------------------------------------------------------------------
-- Recherche d'adhérents : filtre par tag, tags renvoyés
-- ---------------------------------------------------------------------------

drop function public.search_members(uuid, text, public.member_status[], integer, integer);

create function public.search_members(
  p_gym_id uuid,
  p_query text default null,
  p_statuses public.member_status[] default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_tag text default null
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  status public.member_status,
  tags text[],
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      coalesce(
        array(
          select '%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%'
          from regexp_split_to_table(private.search_text(btrim(p_query)), '\s+') as w
          where w <> ''
        ),
        '{}'
      ) as patterns,
      length(regexp_replace(coalesce(p_query, ''), '[^0-9]', '', 'g')) >= 4 as has_phone,
      private.phone_digits(p_query) as phone_query
  )
  select m.id, m.first_name, m.last_name, m.email, m.phone, m.status, m.tags,
         count(*) over () as total_count
  from public.members m, q
  where m.gym_id = p_gym_id
    and (p_statuses is null or cardinality(p_statuses) = 0 or m.status = any (p_statuses))
    and (nullif(btrim(p_tag), '') is null or btrim(p_tag) = any (m.tags))
    and (
      cardinality(q.patterns) = 0
      or (
        private.search_text(m.first_name || ' ' || m.last_name || ' ' || coalesce(m.email, ''))
          like q.patterns[1]
        and private.search_text(m.first_name || ' ' || m.last_name || ' ' || coalesce(m.email, ''))
          like all (q.patterns)
      )
      or (
        q.has_phone
        and q.phone_query <> ''
        and private.phone_digits(m.phone) like '%' || q.phone_query || '%'
      )
    )
  order by private.search_text(m.last_name), private.search_text(m.first_name), m.id
  limit least(greatest(coalesce(p_limit, 20), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function
  public.search_members(uuid, text, public.member_status[], integer, integer, text),
  public.filter_members(uuid, jsonb),
  public.segment_members(uuid),
  public.crm_pipeline(uuid)
from public, anon;
grant execute on function
  public.search_members(uuid, text, public.member_status[], integer, integer, text),
  public.filter_members(uuid, jsonb),
  public.segment_members(uuid),
  public.crm_pipeline(uuid)
to authenticated;
