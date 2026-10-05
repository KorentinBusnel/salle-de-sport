-- Accueil orienté action et Hub 360° par catégorie : permanences à l'accueil, note « à savoir »
-- (accès restreint), digest quotidien de l'assistant (remplace le brief hebdomadaire), et lectures
-- agrégées pour l'accueil (essais du jour, CRM à compléter, impayés).

-- ---------------------------------------------------------------------------
-- Permanences à l'accueil (toute l'équipe peut être affectée, le gérant planifie)
-- ---------------------------------------------------------------------------

create table public.desk_shifts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text check (length(note) <= 200),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '16 hours'),
  unique (id, gym_id)
);
create index desk_shifts_gym_starts_idx on public.desk_shifts (gym_id, starts_at);
create index desk_shifts_profile_idx on public.desk_shifts (profile_id);
create index desk_shifts_created_by_idx on public.desk_shifts (created_by);
create trigger desk_shifts_set_updated_at before update on public.desk_shifts
  for each row execute function private.set_updated_at();

-- La personne affectée doit faire partie de l'équipe de la salle.
create function private.check_desk_shift_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.gym_roles r
    where r.gym_id = new.gym_id and r.profile_id = new.profile_id
      and r.role in ('coach', 'staff', 'manager', 'admin')
  ) then
    raise exception 'not_team_member';
  end if;
  return new;
end;
$$;
create trigger desk_shifts_check_member before insert or update on public.desk_shifts
  for each row execute function private.check_desk_shift_member();

alter table public.desk_shifts enable row level security;
revoke all on public.desk_shifts from anon, authenticated;
grant select, insert, update, delete on public.desk_shifts to authenticated;

create policy "desk_shifts_select_team" on public.desk_shifts
  for select to authenticated using (private.is_gym_team(gym_id));
create policy "desk_shifts_insert_manager" on public.desk_shifts
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "desk_shifts_update_manager" on public.desk_shifts
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "desk_shifts_delete_manager" on public.desk_shifts
  for delete to authenticated using (private.is_gym_manager(gym_id));

-- ---------------------------------------------------------------------------
-- Note « à savoir » (santé, blessure…) : gérant, accueil et coachs de l'adhérent seulement
-- ---------------------------------------------------------------------------

create table public.member_care_notes (
  member_id uuid primary key,
  gym_id uuid not null,
  note text not null check (length(btrim(note)) between 1 and 500),
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (member_id, gym_id),
  foreign key (member_id, gym_id) references public.members (id, gym_id) on delete cascade
);
create index member_care_notes_gym_idx on public.member_care_notes (gym_id);
create index member_care_notes_updated_by_idx on public.member_care_notes (updated_by);
create trigger member_care_notes_set_updated_at before update on public.member_care_notes
  for each row execute function private.set_updated_at();

-- Le profil courant coache-t-il une séance du jour ou à venir où l'adhérent est inscrit ?
create function private.coaches_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings b
    join public.class_sessions s on s.id = b.session_id
    join public.session_coaches sc on sc.session_id = s.id
    join public.coaches c on c.id = sc.coach_id
    where b.member_id = p_member_id
      and b.status in ('confirmed', 'waitlisted', 'attended')
      and s.ends_at > now() - interval '12 hours'
      and c.profile_id = (select auth.uid())
  );
$$;
revoke all on function private.coaches_member(uuid) from public, anon;
grant execute on function private.coaches_member(uuid) to authenticated;

alter table public.member_care_notes enable row level security;
revoke all on public.member_care_notes from anon, authenticated;
grant select, insert, update, delete on public.member_care_notes to authenticated;

create policy "member_care_notes_select" on public.member_care_notes
  for select to authenticated
  using (private.is_gym_staff(gym_id) or private.coaches_member(member_id));
create policy "member_care_notes_insert_staff" on public.member_care_notes
  for insert to authenticated with check (private.is_gym_staff(gym_id));
create policy "member_care_notes_update_staff" on public.member_care_notes
  for update to authenticated
  using (private.is_gym_staff(gym_id))
  with check (private.is_gym_staff(gym_id));
create policy "member_care_notes_delete_staff" on public.member_care_notes
  for delete to authenticated using (private.is_gym_staff(gym_id));

-- ---------------------------------------------------------------------------
-- Digest quotidien de l'assistant (brief du jour + synthèse et actions par catégorie)
-- ---------------------------------------------------------------------------

drop table public.weekly_briefs;

-- content : { brief: { text, actions[] }, categories: [{ key, summary, items[] }], dismissed: [] }
-- (schéma dailyDigestSchema de packages/shared).
create table public.daily_digests (
  gym_id uuid not null references public.gyms (id),
  day date not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  generated_by uuid references public.profiles (id) on delete set null,
  generated_at timestamptz not null default now(),
  primary key (gym_id, day)
);
create index daily_digests_generated_by_idx on public.daily_digests (generated_by);

alter table public.daily_digests enable row level security;
revoke all on public.daily_digests from anon, authenticated;
grant select, insert, update on public.daily_digests to authenticated;

create policy "daily_digests_select_manager" on public.daily_digests
  for select to authenticated using (private.is_gym_manager(gym_id));
create policy "daily_digests_insert_manager" on public.daily_digests
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "daily_digests_update_manager" on public.daily_digests
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));

-- ---------------------------------------------------------------------------
-- Essais et nouveaux venus du jour
-- ---------------------------------------------------------------------------

-- Inscrits aux séances du jour (date de la salle) qui sont en essai (prospect ou tag « essai »)
-- ou à leur 1re ou 2e séance suivie. Équipe : toutes les séances ; coach : les siennes.
-- La note « à savoir » n'est renvoyée qu'à ceux qui ont le droit de la lire.
create function public.today_trials(p_gym_id uuid, p_day date)
returns table (
  session_id uuid,
  starts_at timestamptz,
  discipline text,
  color text,
  coaches text,
  member_id uuid,
  first_name text,
  last_name text,
  is_trial boolean,
  visit_number integer,
  note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_staff boolean := private.is_gym_staff(p_gym_id);
begin
  if not private.is_gym_team(p_gym_id) then
    raise exception 'forbidden';
  end if;
  select timezone into v_tz from public.gyms where id = p_gym_id;

  return query
  select s.id, s.starts_at, d.name, d.color,
    (select string_agg(c.display_name, ', ' order by sc.position)
     from public.session_coaches sc join public.coaches c on c.id = sc.coach_id
     where sc.session_id = s.id),
    m.id, m.first_name, m.last_name,
    (m.status = 'prospect' or 'essai' = any(m.tags)),
    prior.visits + 1,
    n.note
  from public.class_sessions s
  join public.disciplines d on d.id = s.discipline_id
  join public.bookings b on b.session_id = s.id and b.status in ('confirmed', 'attended')
  join public.members m on m.id = b.member_id
  left join public.member_care_notes n on n.member_id = m.id
  cross join lateral (
    select count(*)::integer as visits
    from public.bookings b2
    join public.class_sessions s2 on s2.id = b2.session_id
    where b2.member_id = m.id and b2.status = 'attended' and s2.starts_at < s.starts_at
  ) prior
  where s.gym_id = p_gym_id
    and s.status = 'scheduled'
    and s.starts_at >= (p_day::timestamp at time zone v_tz)
    and s.starts_at < ((p_day + 1)::timestamp at time zone v_tz)
    and (v_staff or private.is_session_coach(s.id))
    and (m.status = 'prospect' or 'essai' = any(m.tags) or prior.visits < 2)
  order by s.starts_at, m.last_name, m.first_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- CRM à compléter (gérant)
-- ---------------------------------------------------------------------------

-- Trois listes d'adhérents (50 au plus chacune) avec leur total :
--  incomplete : actif ou prospect sans email ou sans téléphone ;
--  unanswered : dernier échange (email, WhatsApp, téléphone) entrant, sans réponse depuis ;
--  trials_to_call : prospect venu à une séance ces 7 derniers jours.
create function public.crm_todo(p_gym_id uuid)
returns table (kind text, total integer, member_ids uuid[])
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
    where m.gym_id = p_gym_id and m.status = 'prospect' and s.starts_at > now() - interval '7 days'
    group by m.id
  )
  select 'incomplete'::text, (select count(*)::integer from incomplete),
    coalesce((select array_agg(id order by at desc) from (select * from incomplete order by at desc limit 50) x), '{}')
  union all
  select 'unanswered', (select count(*)::integer from unanswered),
    coalesce((select array_agg(id order by at) from (select * from unanswered order by at limit 50) x), '{}')
  union all
  select 'trials_to_call', (select count(*)::integer from trials),
    coalesce((select array_agg(id order by at desc) from (select * from trials order by at desc limit 50) x), '{}');
end;
$$;

-- ---------------------------------------------------------------------------
-- Impayés clients (gérant)
-- ---------------------------------------------------------------------------

-- Adhérents dont des paiements ont échoué depuis leur dernier paiement réussi, ou dont
-- l'abonnement est en retard de paiement : montant du dernier échec (sinon prix de l'offre),
-- nombre d'échecs consécutifs, date du premier échec.
create function public.unpaid_members(p_gym_id uuid)
returns table (
  member_id uuid,
  first_name text,
  last_name text,
  plan text,
  amount_cents integer,
  failures integer,
  first_failed_at timestamptz
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
  with last_ok as (
    select p.member_id, max(p.created_at) as at
    from public.payments p
    where p.gym_id = p_gym_id and p.status = 'succeeded'
    group by p.member_id
  ),
  fails as (
    select p.member_id, count(*)::integer as failures, min(p.created_at) as first_at,
      (array_agg(p.amount_cents order by p.created_at desc))[1] as amount
    from public.payments p
    left join last_ok l on l.member_id = p.member_id
    where p.gym_id = p_gym_id and p.status = 'failed' and (l.at is null or p.created_at > l.at)
    group by p.member_id
  ),
  late as (
    select distinct on (s.member_id) s.member_id, pl.name, pl.price_cents, s.updated_at
    from public.subscriptions s
    join public.plans pl on pl.id = s.plan_id
    where s.gym_id = p_gym_id and s.status in ('past_due', 'unpaid')
    order by s.member_id, s.updated_at desc
  )
  select m.id, m.first_name, m.last_name, l.name,
    coalesce(f.amount, l.price_cents)::integer,
    coalesce(f.failures, 1),
    coalesce(f.first_at, l.updated_at)
  from public.members m
  left join fails f on f.member_id = m.id
  left join late l on l.member_id = m.id
  where m.gym_id = p_gym_id and (f.member_id is not null or l.member_id is not null)
  order by 7;
end;
$$;

revoke all on function
  public.today_trials(uuid, date),
  public.crm_todo(uuid),
  public.unpaid_members(uuid)
from public, anon;
grant execute on function
  public.today_trials(uuid, date),
  public.crm_todo(uuid),
  public.unpaid_members(uuid)
to authenticated;
