-- Phase 1 : cœur de réservation.
--
-- Règles (BRIEF §12, 2026-10-05) : annulation libre jusqu'au début du cours, crédit toujours
-- rendu (le délai de 2 h n'est qu'une recommandation affichée) ; aucune pénalité ; au plus
-- N réservations à venir (gyms.settings.max_upcoming_bookings, 5 par défaut) ; seul un adhérent
-- actif réserve ; sans abonnement récurrent actif, une réservation consomme 1 crédit ;
-- liste d'attente avec promotion automatique.
--
-- Toute écriture sur bookings passe par les fonctions ci-dessous, qui verrouillent la séance
-- (select … for update) : deux réservations simultanées ne peuvent pas dépasser la capacité.
-- Les erreurs métier sont levées avec un code stable en message (ex. 'member_not_active'),
-- traduit côté client (packages/shared, BOOKING_ERROR_CODES).

-- ---------------------------------------------------------------------------
-- Paramètres de la salle et consentements
-- ---------------------------------------------------------------------------

alter table public.gyms
  alter column settings set default
    '{"max_upcoming_bookings": 5, "cancellation_recommended_hours": 2}'::jsonb;

update public.gyms
set settings = '{"max_upcoming_bookings": 5, "cancellation_recommended_hours": 2}'::jsonb || settings;

alter table public.profiles
  add column terms_accepted_at timestamptz,
  add column waiver_accepted_at timestamptz;

-- ---------------------------------------------------------------------------
-- Compteurs de places (lisibles par tous via le planning public et Realtime)
-- ---------------------------------------------------------------------------

alter table public.class_sessions
  add column booked_count integer not null default 0 check (booked_count >= 0),
  add column waitlist_count integer not null default 0 check (waitlist_count >= 0);

create function private.refresh_session_counts(p_session_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.class_sessions s
  set booked_count = (
        select count(*) from public.bookings b
        where b.session_id = s.id and b.status in ('confirmed', 'attended', 'no_show')
      ),
      waitlist_count = (
        select count(*) from public.bookings b
        where b.session_id = s.id and b.status = 'waitlisted'
      )
  where s.id = p_session_id;
$$;

create function private.bookings_refresh_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.refresh_session_counts(old.session_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.session_id <> old.session_id) then
    perform private.refresh_session_counts(new.session_id);
  end if;
  return null;
end;
$$;

create trigger bookings_refresh_counts
  after insert or update or delete on public.bookings
  for each row execute function private.bookings_refresh_counts();

-- Rattrapage des séances existantes.
update public.class_sessions s
set booked_count = (
      select count(*) from public.bookings b
      where b.session_id = s.id and b.status in ('confirmed', 'attended', 'no_show')
    ),
    waitlist_count = (
      select count(*) from public.bookings b
      where b.session_id = s.id and b.status = 'waitlisted'
    );

-- Places restantes en direct dans l'app (Supabase Realtime).
alter publication supabase_realtime add table public.class_sessions;

-- Les écritures des réservations ne passent plus que par les fonctions.
drop policy "bookings_insert_staff" on public.bookings;
drop policy "bookings_update_staff_or_coach" on public.bookings;
revoke insert, update on public.bookings from authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions internes
-- ---------------------------------------------------------------------------

-- Abonnement récurrent en cours : dispense de crédit.
create function private.has_active_subscription(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions
    where member_id = p_member_id and status in ('active', 'trialing')
  );
$$;

-- Solde de crédits : somme des mouvements du registre.
create function private.credit_balance(p_member_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(delta), 0)::integer from public.credit_ledger where member_id = p_member_id;
$$;

-- L'adhérent peut-il occuper une place maintenant ?
create function private.can_take_seat(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select m.status = 'active'
    and (private.has_active_subscription(m.id) or private.credit_balance(m.id) >= 1)
  from public.members m
  where m.id = p_member_id;
$$;

-- Débite 1 crédit pour une place confirmée si l'adhérent n'a pas d'abonnement.
create function private.debit_seat(p_booking public.bookings)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_active_subscription(p_booking.member_id) then
    insert into public.credit_ledger (gym_id, member_id, delta, reason, booking_id, created_by)
    values (p_booking.gym_id, p_booking.member_id, -1, 'booking', p_booking.id, auth.uid());
  end if;
end;
$$;

-- Rend le crédit débité pour cette réservation, s'il y en a un et qu'il n'a pas déjà été rendu.
create function private.refund_seat(p_booking public.bookings)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.credit_ledger
    where booking_id = p_booking.id and reason = 'booking'
  ) and not exists (
    select 1 from public.credit_ledger
    where booking_id = p_booking.id and reason = 'booking_refund'
  ) then
    insert into public.credit_ledger (gym_id, member_id, delta, reason, booking_id, created_by)
    values (p_booking.gym_id, p_booking.member_id, 1, 'booking_refund', p_booking.id, auth.uid());
  end if;
end;
$$;

-- Promeut la liste d'attente tant qu'il reste des places (la séance doit être verrouillée).
-- Un adhérent devenu inéligible (inactif, sans crédit) garde sa place dans la file et est sauté.
create function private.promote_waitlist(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
  v_candidate public.bookings;
begin
  select * into v_session from public.class_sessions where id = p_session_id;
  if v_session.status <> 'scheduled' or v_session.starts_at <= now() then
    return;
  end if;

  for v_candidate in
    select * from public.bookings
    where session_id = p_session_id and status = 'waitlisted'
    order by waitlist_position
  loop
    select * into v_session from public.class_sessions where id = p_session_id;
    exit when v_session.booked_count >= v_session.capacity;

    if private.can_take_seat(v_candidate.member_id) then
      update public.bookings
      set status = 'confirmed', waitlist_position = null
      where id = v_candidate.id
      returning * into v_candidate;
      perform private.debit_seat(v_candidate);
    end if;
  end loop;

  perform private.renumber_waitlist(p_session_id);
end;
$$;

-- Positions d'attente contiguës (1, 2, 3…) dans l'ordre existant.
create function private.renumber_waitlist(p_session_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bookings b
  set waitlist_position = ranked.position
  from (
    select id, row_number() over (order by waitlist_position, booked_at) as position
    from public.bookings
    where session_id = p_session_id and status = 'waitlisted'
  ) as ranked
  where b.id = ranked.id and b.waitlist_position is distinct from ranked.position;
$$;

-- Annule une réservation active et rend le crédit éventuel (sans promotion).
create function private.cancel_booking_row(p_booking public.bookings)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  update public.bookings
  set status = 'cancelled', cancelled_at = now(), waitlist_position = null
  where id = p_booking.id
  returning * into v_booking;
  perform private.refund_seat(v_booking);
  return v_booking;
end;
$$;

-- Génère les occurrences manquantes des cours récurrents d'une salle (idempotent).
create function private.generate_sessions_for(p_gym_id uuid, p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  insert into public.class_sessions (
    gym_id, template_id, discipline_id, coach_id, room_id, starts_at, ends_at, capacity
  )
  select
    t.gym_id, t.id, t.discipline_id, t.default_coach_id, t.room_id,
    (d::date + t.start_time) at time zone g.timezone,
    (d::date + t.start_time + make_interval(mins => t.duration_minutes)) at time zone g.timezone,
    t.capacity
  from public.class_templates t
  join public.gyms g on g.id = t.gym_id
  cross join generate_series(greatest(p_from, current_date), p_to, interval '1 day') as d
  where t.gym_id = p_gym_id
    and t.is_active
    and extract(isodow from d)::int = t.weekday
    and d::date >= t.starts_on
    and (t.ends_on is null or d::date <= t.ends_on)
  on conflict (template_id, starts_at) where template_id is not null do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- Tâche planifiée : 4 semaines de séances d'avance pour toutes les salles.
create function private.generate_upcoming_sessions()
returns void
language sql
security definer
set search_path = ''
as $$
  select private.generate_sessions_for(id, current_date, current_date + 28) from public.gyms;
$$;

revoke all on all functions in schema private from public;
-- Seules les fonctions appelées par les policies restent exécutables par authenticated.
grant execute on function
  private.has_gym_role(uuid, public.gym_role[]),
  private.is_gym_manager(uuid),
  private.is_gym_staff(uuid),
  private.is_gym_team(uuid),
  private.can_view_profile(uuid),
  private.is_own_member(uuid),
  private.is_own_coach(uuid),
  private.is_session_coach(uuid),
  private.is_member_of_my_classes(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- API (appelées par les apps via supabase.rpc)
-- ---------------------------------------------------------------------------

-- Réserve une place pour soi, ou (accueil et plus) pour un adhérent de la salle.
-- Séance pleine : inscription en liste d'attente.
create function public.book_session(p_session_id uuid, p_member_id uuid default null)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
  v_member public.members;
  v_max integer;
  v_upcoming integer;
  v_booking public.bookings;
begin
  select * into v_session from public.class_sessions where id = p_session_id for update;
  if not found then
    raise exception 'session_not_found';
  end if;
  if v_session.status <> 'scheduled' then
    raise exception 'session_cancelled';
  end if;
  if v_session.starts_at <= now() then
    raise exception 'session_started';
  end if;

  if p_member_id is null then
    select * into v_member from public.members
    where gym_id = v_session.gym_id and profile_id = (select auth.uid());
    if not found then
      raise exception 'not_a_member';
    end if;
  else
    select * into v_member from public.members
    where id = p_member_id and gym_id = v_session.gym_id;
    if not found then
      raise exception 'member_not_found';
    end if;
    if v_member.profile_id is distinct from (select auth.uid())
      and not private.is_gym_staff(v_session.gym_id) then
      raise exception 'forbidden';
    end if;
  end if;

  if v_member.status <> 'active' then
    raise exception 'member_not_active';
  end if;

  if exists (
    select 1 from public.bookings
    where session_id = v_session.id and member_id = v_member.id and status <> 'cancelled'
  ) then
    raise exception 'already_booked';
  end if;

  select coalesce((settings ->> 'max_upcoming_bookings')::integer, 5) into v_max
  from public.gyms where id = v_session.gym_id;

  select count(*) into v_upcoming
  from public.bookings b
  join public.class_sessions s on s.id = b.session_id
  where b.member_id = v_member.id
    and b.status in ('confirmed', 'waitlisted')
    and s.starts_at > now();
  if v_upcoming >= v_max then
    raise exception 'max_upcoming_reached';
  end if;

  if not private.can_take_seat(v_member.id) then
    raise exception 'no_credit';
  end if;

  if v_session.booked_count < v_session.capacity then
    insert into public.bookings (gym_id, session_id, member_id, status)
    values (v_session.gym_id, v_session.id, v_member.id, 'confirmed')
    returning * into v_booking;
    perform private.debit_seat(v_booking);
  else
    insert into public.bookings (gym_id, session_id, member_id, status, waitlist_position)
    values (v_session.gym_id, v_session.id, v_member.id, 'waitlisted', v_session.waitlist_count + 1)
    returning * into v_booking;
  end if;

  return v_booking;
end;
$$;

-- Annule une réservation (la sienne, ou n'importe laquelle de la salle pour l'accueil).
-- Libre jusqu'au début du cours, crédit rendu ; la place libérée profite à la liste d'attente.
create function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session_id uuid;
  v_session public.class_sessions;
  v_booking public.bookings;
  v_is_staff boolean;
begin
  select session_id into v_session_id from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'booking_not_found';
  end if;

  select * into v_session from public.class_sessions where id = v_session_id for update;
  select * into v_booking from public.bookings where id = p_booking_id for update;

  v_is_staff := private.is_gym_staff(v_booking.gym_id);
  if not v_is_staff and not private.is_own_member(v_booking.member_id) then
    raise exception 'forbidden';
  end if;
  if v_booking.status not in ('confirmed', 'waitlisted') then
    raise exception 'not_cancellable';
  end if;
  if v_session.starts_at <= now() and not v_is_staff then
    raise exception 'session_started';
  end if;

  v_booking := private.cancel_booking_row(v_booking);
  perform private.promote_waitlist(v_session.id);
  return v_booking;
end;
$$;

-- Pointage : présent ou absent (coach de la séance, ou accueil).
create function public.set_attendance(p_booking_id uuid, p_status public.booking_status)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  if p_status not in ('attended', 'no_show') then
    raise exception 'invalid_status';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking_not_found';
  end if;
  if not private.is_gym_staff(v_booking.gym_id) and not private.is_session_coach(v_booking.session_id) then
    raise exception 'forbidden';
  end if;
  if v_booking.status not in ('confirmed', 'attended', 'no_show') then
    raise exception 'not_attendable';
  end if;

  update public.bookings
  set status = p_status,
      checked_in_at = case when p_status = 'attended' then coalesce(checked_in_at, now()) end
  where id = p_booking_id
  returning * into v_booking;
  return v_booking;
end;
$$;

-- Annule une séance (gérant) : tous les inscrits sont annulés et recrédités.
create function public.cancel_session(p_session_id uuid, p_reason text default null)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
  v_booking public.bookings;
begin
  select * into v_session from public.class_sessions where id = p_session_id for update;
  if not found then
    raise exception 'session_not_found';
  end if;
  if not private.is_gym_manager(v_session.gym_id) then
    raise exception 'forbidden';
  end if;
  if v_session.status = 'cancelled' then
    raise exception 'session_cancelled';
  end if;

  for v_booking in
    select * from public.bookings
    where session_id = p_session_id and status in ('confirmed', 'waitlisted')
  loop
    perform private.cancel_booking_row(v_booking);
  end loop;

  update public.class_sessions
  set status = 'cancelled', cancellation_reason = p_reason
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

-- Génère les séances d'une période à partir des cours récurrents (gérant).
create function public.generate_sessions(p_gym_id uuid, p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  if p_to < p_from or p_to > p_from + 90 then
    raise exception 'invalid_period';
  end if;
  return private.generate_sessions_for(p_gym_id, p_from, p_to);
end;
$$;

-- Après inscription dans l'app : crée la fiche adhérent (prospect) et le rôle member,
-- ou rattache la fiche prospect existante de même email. Une seule salle au MVP : la première.
create function public.join_gym(p_terms_accepted boolean, p_waiver_accepted boolean)
returns public.members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_profile public.profiles;
  v_gym_id uuid;
  v_member public.members;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if v_profile.terms_accepted_at is null and not coalesce(p_terms_accepted, false) then
    raise exception 'terms_not_accepted';
  end if;
  if v_profile.waiver_accepted_at is null and not coalesce(p_waiver_accepted, false) then
    raise exception 'waiver_not_accepted';
  end if;

  update public.profiles
  set terms_accepted_at = coalesce(terms_accepted_at, now()),
      waiver_accepted_at = coalesce(waiver_accepted_at, now())
  where id = v_user_id
  returning * into v_profile;

  select email into v_email from auth.users where id = v_user_id;
  select id into v_gym_id from public.gyms order by created_at, id limit 1;

  select * into v_member from public.members where gym_id = v_gym_id and profile_id = v_user_id;
  if not found then
    -- Prospect déjà connu (email, WhatsApp…) : on rattache sa fiche au compte.
    update public.members
    set profile_id = v_user_id
    where id = (
      select id from public.members
      where gym_id = v_gym_id and profile_id is null and lower(email) = lower(v_email)
      order by created_at
      limit 1
    )
    returning * into v_member;
  end if;
  if v_member.id is null then
    insert into public.members (gym_id, profile_id, first_name, last_name, email, phone, acquisition_source)
    values (
      v_gym_id, v_user_id,
      coalesce(nullif(v_profile.first_name, ''), split_part(v_email, '@', 1)),
      coalesce(v_profile.last_name, ''),
      v_email, v_profile.phone, 'app'
    )
    returning * into v_member;
  end if;

  insert into public.gym_roles (gym_id, profile_id, role)
  values (v_gym_id, v_user_id, 'member')
  on conflict (gym_id, profile_id, role) do nothing;

  return v_member;
end;
$$;

revoke all on function
  public.book_session(uuid, uuid),
  public.cancel_booking(uuid),
  public.set_attendance(uuid, public.booking_status),
  public.cancel_session(uuid, text),
  public.generate_sessions(uuid, date, date),
  public.join_gym(boolean, boolean)
from public, anon;
grant execute on function
  public.book_session(uuid, uuid),
  public.cancel_booking(uuid),
  public.set_attendance(uuid, public.booking_status),
  public.cancel_session(uuid, text),
  public.generate_sessions(uuid, date, date),
  public.join_gym(boolean, boolean)
to authenticated;

-- ---------------------------------------------------------------------------
-- Génération automatique des séances (pg_cron, chaque nuit à 3 h 17 UTC)
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule(
  'generate-upcoming-sessions',
  '17 3 * * *',
  'select private.generate_upcoming_sessions()'
);
