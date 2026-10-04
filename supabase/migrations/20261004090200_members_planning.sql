-- Adhérents, coachs, planning des cours et réservations.
--
-- Convention multi-salles : chaque table métier porte gym_id et expose
-- unique (id, gym_id) ; les clés étrangères entre tables métier sont composites
-- (x_id, gym_id) pour interdire tout rattachement à une autre salle.

create table public.members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  -- Facultatif : un prospect venu par email ou WhatsApp n'a pas de compte.
  profile_id uuid references public.profiles (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  status public.member_status not null default 'prospect',
  acquisition_source text,
  stripe_customer_id text unique,
  tags text[] not null default '{}',
  -- Consentements marketing distincts (RGPD, BRIEF §7.3) : null = pas de consentement.
  marketing_email_consent_at timestamptz,
  marketing_whatsapp_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  unique (gym_id, profile_id)
);
create index members_gym_status_idx on public.members (gym_id, status);
create index members_gym_email_idx on public.members (gym_id, lower(email));
create index members_gym_phone_idx on public.members (gym_id, phone);
create index members_profile_id_idx on public.members (profile_id);

create table public.disciplines (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  name text not null,
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  unique (gym_id, name)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  name text not null,
  capacity integer not null check (capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  unique (gym_id, name)
);

-- Fiche publique du coach (affichée dans le planning). La rémunération est
-- isolée dans coach_compensations, réservée aux gérants.
create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  profile_id uuid references public.profiles (id) on delete set null,
  display_name text not null,
  bio text,
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  unique (gym_id, profile_id)
);
create index coaches_profile_id_idx on public.coaches (profile_id);

create table public.coach_disciplines (
  gym_id uuid not null,
  coach_id uuid not null,
  discipline_id uuid not null,
  primary key (coach_id, discipline_id),
  foreign key (coach_id, gym_id) references public.coaches (id, gym_id) on delete cascade,
  foreign key (discipline_id, gym_id) references public.disciplines (id, gym_id) on delete cascade
);

create table public.coach_compensations (
  coach_id uuid primary key,
  gym_id uuid not null,
  employment_type public.employment_type not null,
  hourly_rate_cents integer check (hourly_rate_cents >= 0),
  updated_at timestamptz not null default now(),
  foreign key (coach_id, gym_id) references public.coaches (id, gym_id) on delete cascade
);

create table public.class_templates (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  discipline_id uuid not null,
  default_coach_id uuid,
  room_id uuid,
  -- Jour ISO : 1 = lundi … 7 = dimanche. Heure locale de la salle (gyms.timezone).
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  capacity integer not null check (capacity > 0),
  starts_on date not null default current_date,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  check (ends_on is null or ends_on >= starts_on),
  foreign key (discipline_id, gym_id) references public.disciplines (id, gym_id),
  foreign key (default_coach_id, gym_id) references public.coaches (id, gym_id),
  foreign key (room_id, gym_id) references public.rooms (id, gym_id)
);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  template_id uuid,
  discipline_id uuid not null,
  coach_id uuid,
  room_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  status public.session_status not null default 'scheduled',
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  check (ends_at > starts_at),
  foreign key (template_id, gym_id) references public.class_templates (id, gym_id),
  foreign key (discipline_id, gym_id) references public.disciplines (id, gym_id),
  foreign key (coach_id, gym_id) references public.coaches (id, gym_id),
  foreign key (room_id, gym_id) references public.rooms (id, gym_id)
);
create index class_sessions_gym_starts_at_idx on public.class_sessions (gym_id, starts_at);
create index class_sessions_coach_id_idx on public.class_sessions (coach_id);
-- Une occurrence par template et par créneau : génération des récurrences idempotente.
create unique index class_sessions_template_slot_idx
  on public.class_sessions (template_id, starts_at) where template_id is not null;

-- Les écritures des adhérents (réserver, annuler, liste d'attente) passeront par
-- des fonctions Postgres transactionnelles en phase 1, jamais par un INSERT direct.
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  session_id uuid not null,
  member_id uuid not null,
  status public.booking_status not null,
  waitlist_position integer check (waitlist_position > 0),
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  check ((status = 'waitlisted') = (waitlist_position is not null)),
  foreign key (session_id, gym_id) references public.class_sessions (id, gym_id),
  foreign key (member_id, gym_id) references public.members (id, gym_id)
);
-- Au plus une réservation active par adhérent et par séance (une annulée peut être refaite).
create unique index bookings_active_member_session_idx
  on public.bookings (session_id, member_id) where status <> 'cancelled';
create index bookings_member_id_idx on public.bookings (member_id);

create table public.coach_availabilities (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  coach_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  valid_from date not null default current_date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (valid_until is null or valid_until >= valid_from),
  foreign key (coach_id, gym_id) references public.coaches (id, gym_id) on delete cascade
);
create index coach_availabilities_coach_id_idx on public.coach_availabilities (coach_id);

-- Heures réellement assurées (export paie) et remplacements.
create table public.coach_shifts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  coach_id uuid not null,
  session_id uuid,
  -- Coach initialement prévu, quand ce créneau est un remplacement.
  replaced_coach_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.shift_status not null default 'planned',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (coach_id, gym_id) references public.coaches (id, gym_id),
  foreign key (replaced_coach_id, gym_id) references public.coaches (id, gym_id),
  foreign key (session_id, gym_id) references public.class_sessions (id, gym_id)
);
create index coach_shifts_coach_starts_at_idx on public.coach_shifts (coach_id, starts_at);

create trigger members_set_updated_at before update on public.members
  for each row execute function private.set_updated_at();
create trigger disciplines_set_updated_at before update on public.disciplines
  for each row execute function private.set_updated_at();
create trigger rooms_set_updated_at before update on public.rooms
  for each row execute function private.set_updated_at();
create trigger coaches_set_updated_at before update on public.coaches
  for each row execute function private.set_updated_at();
create trigger coach_compensations_set_updated_at before update on public.coach_compensations
  for each row execute function private.set_updated_at();
create trigger class_templates_set_updated_at before update on public.class_templates
  for each row execute function private.set_updated_at();
create trigger class_sessions_set_updated_at before update on public.class_sessions
  for each row execute function private.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function private.set_updated_at();
create trigger coach_availabilities_set_updated_at before update on public.coach_availabilities
  for each row execute function private.set_updated_at();
create trigger coach_shifts_set_updated_at before update on public.coach_shifts
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Fonctions d'aide aux policies (voir 20261004090100 pour le principe).
-- ---------------------------------------------------------------------------

-- La fiche adhérent appartient-elle à l'utilisateur courant ?
create function private.is_own_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members
    where id = p_member_id and profile_id = (select auth.uid())
  );
$$;

-- La fiche coach appartient-elle à l'utilisateur courant ?
create function private.is_own_coach(p_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.coaches
    where id = p_coach_id and profile_id = (select auth.uid())
  );
$$;

-- L'utilisateur courant est-il le coach de cette séance ?
create function private.is_session_coach(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_sessions s
    join public.coaches c on c.id = s.coach_id
    where s.id = p_session_id and c.profile_id = (select auth.uid())
  );
$$;

-- L'adhérent a-t-il une réservation dans une séance du coach courant ?
create function private.is_member_of_my_classes(p_member_id uuid)
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
    join public.coaches c on c.id = s.coach_id
    where b.member_id = p_member_id and c.profile_id = (select auth.uid())
  );
$$;

revoke all on function
  private.is_own_member(uuid),
  private.is_own_coach(uuid),
  private.is_session_coach(uuid),
  private.is_member_of_my_classes(uuid)
from public;
grant execute on function
  private.is_own_member(uuid),
  private.is_own_coach(uuid),
  private.is_session_coach(uuid),
  private.is_member_of_my_classes(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Droits et RLS
-- ---------------------------------------------------------------------------

alter table public.members enable row level security;
alter table public.disciplines enable row level security;
alter table public.rooms enable row level security;
alter table public.coaches enable row level security;
alter table public.coach_disciplines enable row level security;
alter table public.coach_compensations enable row level security;
alter table public.class_templates enable row level security;
alter table public.class_sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.coach_availabilities enable row level security;
alter table public.coach_shifts enable row level security;

revoke all on
  public.members, public.disciplines, public.rooms, public.coaches, public.coach_disciplines,
  public.coach_compensations, public.class_templates, public.class_sessions, public.bookings,
  public.coach_availabilities, public.coach_shifts
from anon, authenticated;

-- Planning public : lisible sans compte.
grant select on
  public.disciplines, public.rooms, public.coaches, public.coach_disciplines, public.class_sessions
to anon;
grant select, insert, update, delete on
  public.members, public.disciplines, public.rooms, public.coaches, public.coach_disciplines,
  public.coach_compensations, public.class_templates, public.class_sessions,
  public.coach_availabilities, public.coach_shifts
to authenticated;
-- Pas de DELETE sur les réservations : on annule (statut), on ne supprime pas.
grant select, insert, update on public.bookings to authenticated;

-- members : l'adhérent voit sa fiche ; l'accueil gère les fiches de sa salle ;
-- le coach lit (sans écrire) les fiches des adhérents inscrits à ses cours.
create policy "members_select" on public.members
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or private.is_gym_staff(gym_id)
    or private.is_member_of_my_classes(id)
  );
create policy "members_insert_staff" on public.members
  for insert to authenticated with check (private.is_gym_staff(gym_id));
create policy "members_update_staff" on public.members
  for update to authenticated
  using (private.is_gym_staff(gym_id))
  with check (private.is_gym_staff(gym_id));
create policy "members_delete_manager" on public.members
  for delete to authenticated using (private.is_gym_manager(gym_id));

-- Catalogue du planning : lecture publique, écriture par les gérants.
create policy "disciplines_select_public" on public.disciplines
  for select to anon, authenticated using (true);
create policy "disciplines_insert_manager" on public.disciplines
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "disciplines_update_manager" on public.disciplines
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "disciplines_delete_manager" on public.disciplines
  for delete to authenticated using (private.is_gym_manager(gym_id));

create policy "rooms_select_public" on public.rooms
  for select to anon, authenticated using (true);
create policy "rooms_insert_manager" on public.rooms
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "rooms_update_manager" on public.rooms
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "rooms_delete_manager" on public.rooms
  for delete to authenticated using (private.is_gym_manager(gym_id));

create policy "coaches_select_public" on public.coaches
  for select to anon, authenticated using (true);
create policy "coaches_insert_manager" on public.coaches
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "coaches_update_manager" on public.coaches
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "coaches_delete_manager" on public.coaches
  for delete to authenticated using (private.is_gym_manager(gym_id));

create policy "coach_disciplines_select_public" on public.coach_disciplines
  for select to anon, authenticated using (true);
create policy "coach_disciplines_insert_manager" on public.coach_disciplines
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "coach_disciplines_update_manager" on public.coach_disciplines
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "coach_disciplines_delete_manager" on public.coach_disciplines
  for delete to authenticated using (private.is_gym_manager(gym_id));

-- Rémunération : le gérant, et le coach concerné en lecture.
create policy "coach_compensations_select" on public.coach_compensations
  for select to authenticated
  using (private.is_gym_manager(gym_id) or private.is_own_coach(coach_id));
create policy "coach_compensations_insert_manager" on public.coach_compensations
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "coach_compensations_update_manager" on public.coach_compensations
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "coach_compensations_delete_manager" on public.coach_compensations
  for delete to authenticated using (private.is_gym_manager(gym_id));

-- Modèles de cours : outil interne de l'équipe.
create policy "class_templates_select_team" on public.class_templates
  for select to authenticated using (private.is_gym_team(gym_id));
create policy "class_templates_insert_manager" on public.class_templates
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "class_templates_update_manager" on public.class_templates
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "class_templates_delete_manager" on public.class_templates
  for delete to authenticated using (private.is_gym_manager(gym_id));

create policy "class_sessions_select_public" on public.class_sessions
  for select to anon, authenticated using (true);
create policy "class_sessions_insert_manager" on public.class_sessions
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "class_sessions_update_manager" on public.class_sessions
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "class_sessions_delete_manager" on public.class_sessions
  for delete to authenticated using (private.is_gym_manager(gym_id));

-- bookings : l'adhérent lit les siennes ; l'accueil gère celles de sa salle ;
-- le coach lit et pointe celles de ses séances.
create policy "bookings_select" on public.bookings
  for select to authenticated
  using (
    private.is_own_member(member_id)
    or private.is_gym_staff(gym_id)
    or private.is_session_coach(session_id)
  );
create policy "bookings_insert_staff" on public.bookings
  for insert to authenticated with check (private.is_gym_staff(gym_id));
create policy "bookings_update_staff_or_coach" on public.bookings
  for update to authenticated
  using (private.is_gym_staff(gym_id) or private.is_session_coach(session_id))
  with check (private.is_gym_staff(gym_id) or private.is_session_coach(session_id));

-- Disponibilités : le coach gère les siennes ; l'équipe d'accueil les consulte.
create policy "coach_availabilities_select" on public.coach_availabilities
  for select to authenticated
  using (private.is_gym_staff(gym_id) or private.is_own_coach(coach_id));
create policy "coach_availabilities_insert" on public.coach_availabilities
  for insert to authenticated with check (private.is_gym_manager(gym_id) or private.is_own_coach(coach_id));
create policy "coach_availabilities_update" on public.coach_availabilities
  for update to authenticated
  using (private.is_gym_manager(gym_id) or private.is_own_coach(coach_id))
  with check (private.is_gym_manager(gym_id) or private.is_own_coach(coach_id));
create policy "coach_availabilities_delete" on public.coach_availabilities
  for delete to authenticated using (private.is_gym_manager(gym_id) or private.is_own_coach(coach_id));

-- Créneaux réalisés (base de la paie) : le gérant, et le coach en lecture des siens.
create policy "coach_shifts_select" on public.coach_shifts
  for select to authenticated
  using (private.is_gym_manager(gym_id) or private.is_own_coach(coach_id));
create policy "coach_shifts_insert_manager" on public.coach_shifts
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "coach_shifts_update_manager" on public.coach_shifts
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "coach_shifts_delete_manager" on public.coach_shifts
  for delete to authenticated using (private.is_gym_manager(gym_id));
