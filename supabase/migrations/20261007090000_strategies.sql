-- Stratégies configurables par le gérant (BRIEF §12, 2026-10-04) : les questions laissées
-- ouvertes en phase 1 deviennent des réglages de gyms.settings, tous désactivés par défaut
-- (gymSettingsSchema dans packages/shared en est le miroir) :
--   late_booking_minutes             l'accueil inscrit un retardataire jusqu'à N min après le début
--   attendance_opens_minutes_before  le pointage ouvre N min avant le début (null : sans limite)
--   allow_attendance_reset           « remettre à confirmé » un pointage
--   manager_can_remove_credits       le gérant retire des crédits (motif obligatoire)
--   staff_can_suspend_members        l'accueil suspend et réactive une fiche
--   staff_can_create_members         l'accueil crée une fiche
-- Fiches et crédits ne s'écrivent plus que par des fonctions qui appliquent ces règles.

-- ---------------------------------------------------------------------------
-- Lecture des réglages (valeur absente ou mal typée : défaut)
-- ---------------------------------------------------------------------------

create function private.gym_setting_int(p_gym_id uuid, p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when jsonb_typeof(settings -> p_key) = 'number'
    then floor((settings ->> p_key)::numeric)::integer end
  from public.gyms where id = p_gym_id;
$$;

create function private.gym_setting_bool(p_gym_id uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (settings -> p_key) = 'true'::jsonb from public.gyms where id = p_gym_id), false);
$$;

revoke all on function private.gym_setting_int(uuid, text), private.gym_setting_bool(uuid, text)
from public, anon;
grant execute on function private.gym_setting_int(uuid, text), private.gym_setting_bool(uuid, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Réservation : tolérance de retard pour l'accueil
-- ---------------------------------------------------------------------------

create or replace function public.book_session(p_session_id uuid, p_member_id uuid default null)
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
  v_late integer;
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
    -- Retardataire : seul l'accueil l'inscrit, dans la tolérance réglée par la salle.
    v_late := coalesce(private.gym_setting_int(v_session.gym_id, 'late_booking_minutes'), 0);
    if p_member_id is null
      or not private.is_gym_staff(v_session.gym_id)
      or now() >= least(v_session.starts_at + make_interval(mins => v_late), v_session.ends_at) then
      raise exception 'session_started';
    end if;
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
  elsif v_session.starts_at <= now() then
    -- Pas de liste d'attente pour une séance commencée.
    raise exception 'session_full';
  else
    insert into public.bookings (gym_id, session_id, member_id, status, waitlist_position)
    values (v_session.gym_id, v_session.id, v_member.id, 'waitlisted', v_session.waitlist_count + 1)
    returning * into v_booking;
  end if;

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pointage : fenêtre d'ouverture, remise à « confirmé »
-- ---------------------------------------------------------------------------

create or replace function public.set_attendance(p_booking_id uuid, p_status public.booking_status)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_starts_at timestamptz;
  v_opens integer;
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

  v_opens := private.gym_setting_int(v_booking.gym_id, 'attendance_opens_minutes_before');
  if v_opens is not null then
    select starts_at into v_starts_at from public.class_sessions where id = v_booking.session_id;
    if now() < v_starts_at - make_interval(mins => v_opens) then
      raise exception 'attendance_not_open';
    end if;
  end if;

  update public.bookings
  set status = p_status,
      checked_in_at = case when p_status = 'attended' then coalesce(checked_in_at, now()) end
  where id = p_booking_id
  returning * into v_booking;
  return v_booking;
end;
$$;

-- Annule un pointage (présent ou absent → confirmé), si la salle l'autorise.
create function public.reset_attendance(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking_not_found';
  end if;
  if not private.is_gym_staff(v_booking.gym_id) and not private.is_session_coach(v_booking.session_id) then
    raise exception 'forbidden';
  end if;
  if not private.gym_setting_bool(v_booking.gym_id, 'allow_attendance_reset') then
    raise exception 'strategy_disabled';
  end if;
  if v_booking.status not in ('attended', 'no_show') then
    raise exception 'not_attendable';
  end if;

  update public.bookings
  set status = 'confirmed', checked_in_at = null
  where id = p_booking_id
  returning * into v_booking;
  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Crédits : ajout (gérant), retrait avec motif si la salle l'autorise
-- ---------------------------------------------------------------------------

create function public.adjust_credits(p_member_id uuid, p_delta integer, p_note text default null)
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
  if p_delta is null or p_delta = 0 or abs(p_delta) > 50 then
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

-- ---------------------------------------------------------------------------
-- Fiches adhérents : statut et création
-- ---------------------------------------------------------------------------

-- Changements de statut :
--   prospect → actif                 accueil
--   actif ⇄ suspendu                 gérant, ou accueil si staff_can_suspend_members
--   → résilié, résilié → actif       gérant
create function public.set_member_status(p_member_id uuid, p_status public.member_status)
returns public.members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_manager boolean;
begin
  select * into v_member from public.members where id = p_member_id for update;
  if not found then
    raise exception 'member_not_found';
  end if;
  if not private.is_gym_staff(v_member.gym_id) then
    raise exception 'forbidden';
  end if;
  v_manager := private.is_gym_manager(v_member.gym_id);

  if p_status = v_member.status or p_status = 'prospect' then
    raise exception 'invalid_transition';
  end if;
  if p_status = 'cancelled' or v_member.status = 'cancelled' then
    if not v_manager then
      raise exception 'forbidden';
    end if;
  elsif p_status = 'suspended' or v_member.status = 'suspended' then
    if v_member.status = 'prospect' then
      raise exception 'invalid_transition';
    end if;
    if not v_manager
      and not private.gym_setting_bool(v_member.gym_id, 'staff_can_suspend_members') then
      raise exception 'strategy_disabled';
    end if;
  end if;

  update public.members set status = p_status where id = p_member_id returning * into v_member;
  return v_member;
end;
$$;

-- Fiches de la salle qui partagent l'email ou le téléphone donnés (détection de doublons).
create function public.find_member_duplicates(p_gym_id uuid, p_email text, p_phone text)
returns setof public.members
language sql
stable
security invoker
set search_path = ''
as $$
  select m.* from public.members m
  where m.gym_id = p_gym_id
    and (
      (nullif(btrim(p_email), '') is not null and lower(m.email) = lower(btrim(p_email)))
      or (
        length(private.phone_digits(p_phone)) >= 6
        and private.phone_digits(m.phone) = private.phone_digits(p_phone)
      )
    )
  order by m.created_at
  limit 5;
$$;

-- Crée une fiche (prospect ou active) : gérant, ou accueil si staff_can_create_members.
-- Un doublon (même email ou téléphone) bloque la création, sauf confirmation (p_force).
create function public.create_member(
  p_gym_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text default null,
  p_phone text default null,
  p_status public.member_status default 'prospect',
  p_force boolean default false
)
returns public.members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members;
begin
  if not private.is_gym_staff(p_gym_id) then
    raise exception 'forbidden';
  end if;
  if not private.is_gym_manager(p_gym_id)
    and not private.gym_setting_bool(p_gym_id, 'staff_can_create_members') then
    raise exception 'strategy_disabled';
  end if;
  if p_status not in ('prospect', 'active')
    or nullif(btrim(coalesce(p_first_name, '')), '') is null
    or nullif(btrim(coalesce(p_last_name, '')), '') is null then
    raise exception 'invalid_input';
  end if;
  if not coalesce(p_force, false) and exists (
    select 1 from public.find_member_duplicates(p_gym_id, p_email, p_phone)
  ) then
    raise exception 'duplicate_member';
  end if;

  insert into public.members (gym_id, first_name, last_name, email, phone, status, acquisition_source)
  values (
    p_gym_id, btrim(p_first_name), btrim(p_last_name),
    nullif(lower(btrim(coalesce(p_email, ''))), ''), nullif(btrim(coalesce(p_phone, '')), ''),
    p_status, 'back_office'
  )
  returning * into v_member;
  return v_member;
end;
$$;

revoke all on function
  public.reset_attendance(uuid),
  public.adjust_credits(uuid, integer, text),
  public.set_member_status(uuid, public.member_status),
  public.find_member_duplicates(uuid, text, text),
  public.create_member(uuid, text, text, text, text, public.member_status, boolean)
from public, anon;
grant execute on function
  public.reset_attendance(uuid),
  public.adjust_credits(uuid, integer, text),
  public.set_member_status(uuid, public.member_status),
  public.find_member_duplicates(uuid, text, text),
  public.create_member(uuid, text, text, text, text, public.member_status, boolean)
to authenticated;

-- ---------------------------------------------------------------------------
-- Droits : création, statut et crédits passent par les fonctions ci-dessus
-- ---------------------------------------------------------------------------

drop policy "members_insert_staff" on public.members;
revoke insert, update on public.members from authenticated;
grant update (
  first_name, last_name, email, phone, acquisition_source, tags,
  marketing_email_consent_at, marketing_whatsapp_consent_at
) on public.members to authenticated;

drop policy "credit_ledger_insert_manager" on public.credit_ledger;
revoke insert on public.credit_ledger from authenticated;
