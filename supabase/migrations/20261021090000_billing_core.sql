-- Socle de la facturation, sans Stripe (BRIEF §12, 2026-10-06) :
-- - offres : public visé, justificatif, ordre, disciplines couvertes ;
-- - accès aux cours selon la discipline de la séance (abonnement ou lot de crédits) ;
-- - crédits rangés par lots (achat, ajout manuel) qui expirent, consommés du lot qui expire
--   le premier ;
-- - ventes sur place (carnet, séance, abonnement suivi hors Stripe), renouvellement, fin ;
-- - codes promo ;
-- - indicateurs financiers (CA, MRR, paiements échoués).

-- ---------------------------------------------------------------------------
-- Offres
-- ---------------------------------------------------------------------------

alter table public.plans
  add column audience text check (char_length(audience) <= 60),
  add column requires_proof boolean not null default false,
  add column position integer not null default 0,
  add column all_disciplines boolean not null default true;

comment on column public.plans.audience is 'Public visé d''un tarif réduit (« Étudiants »…), affiché avec l''offre.';
comment on column public.plans.requires_proof is 'Justificatif à présenter à l''accueil.';
comment on column public.plans.all_disciplines is 'Faux : seules les disciplines de plan_disciplines sont couvertes.';

-- Une offre couvre-t-elle la discipline ? (offre absente : ajout manuel, tout est couvert)
create function private.plan_covers(p_plan_id uuid, p_discipline_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_plan_id is null or exists (
    select 1 from public.plans p
    where p.id = p_plan_id
      and (p.all_disciplines or exists (
        select 1 from public.plan_disciplines pd
        where pd.plan_id = p.id and pd.discipline_id = p_discipline_id
      ))
  );
$$;

-- ---------------------------------------------------------------------------
-- Codes promo
-- ---------------------------------------------------------------------------

create type public.promo_kind as enum ('percent', 'amount');

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  code text not null check (code ~ '^[A-Z0-9_-]{3,30}$'),
  kind public.promo_kind not null,
  -- Pourcentage (1 à 100) ou montant en centimes.
  value integer not null check (value > 0),
  starts_on date,
  ends_on date,
  max_redemptions integer check (max_redemptions > 0),
  is_active boolean not null default true,
  stripe_coupon_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  unique (gym_id, code),
  check (kind <> 'percent' or value <= 100),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

-- Offres concernées par un code (aucune ligne : toutes les offres).
create table public.promo_code_plans (
  gym_id uuid not null,
  promo_code_id uuid not null,
  plan_id uuid not null,
  primary key (promo_code_id, plan_id),
  foreign key (promo_code_id, gym_id) references public.promo_codes (id, gym_id) on delete cascade,
  foreign key (plan_id, gym_id) references public.plans (id, gym_id) on delete cascade
);
create index promo_code_plans_plan_id_idx on public.promo_code_plans (plan_id);

create trigger promo_codes_set_updated_at before update on public.promo_codes
  for each row execute function private.set_updated_at();

alter table public.promo_codes enable row level security;
alter table public.promo_code_plans enable row level security;
revoke all on public.promo_codes, public.promo_code_plans from anon, authenticated;
grant select, insert, update, delete on public.promo_codes, public.promo_code_plans to authenticated;

create policy "promo_codes_select_manager" on public.promo_codes
  for select to authenticated using (private.is_gym_manager(gym_id));
create policy "promo_codes_insert_manager" on public.promo_codes
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "promo_codes_update_manager" on public.promo_codes
  for update to authenticated
  using (private.is_gym_manager(gym_id)) with check (private.is_gym_manager(gym_id));
create policy "promo_codes_delete_manager" on public.promo_codes
  for delete to authenticated using (private.is_gym_manager(gym_id));

create policy "promo_code_plans_select_manager" on public.promo_code_plans
  for select to authenticated using (private.is_gym_manager(gym_id));
create policy "promo_code_plans_insert_manager" on public.promo_code_plans
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "promo_code_plans_delete_manager" on public.promo_code_plans
  for delete to authenticated using (private.is_gym_manager(gym_id));

-- ---------------------------------------------------------------------------
-- Paiements : offre, code promo, auteur d'une vente sur place
-- ---------------------------------------------------------------------------

alter table public.payments
  add column plan_id uuid,
  add column promo_code_id uuid,
  add column recorded_by uuid references public.profiles (id) on delete set null,
  add foreign key (plan_id, gym_id) references public.plans (id, gym_id),
  add foreign key (promo_code_id, gym_id) references public.promo_codes (id, gym_id) on delete set null (promo_code_id);
create index payments_plan_id_idx on public.payments (plan_id);
create index payments_promo_code_id_idx on public.payments (promo_code_id);

-- ---------------------------------------------------------------------------
-- Crédits par lots
-- ---------------------------------------------------------------------------
-- Un lot = une ligne positive d'achat, de renouvellement ou d'ajout manuel (lot_id = id).
-- Chaque mouvement ultérieur (réservation, remboursement, retrait, expiration) porte le lot
-- qu'il touche : restant d'un lot = somme des delta de ce lot. Le solde reste la somme de tout.

alter table public.credit_ledger
  add column lot_id uuid references public.credit_ledger (id),
  add column plan_id uuid,
  add foreign key (plan_id, gym_id) references public.plans (id, gym_id);
create index credit_ledger_lot_id_idx on public.credit_ledger (lot_id);
create index credit_ledger_plan_id_idx on public.credit_ledger (plan_id);

-- Restant d'un lot.
create function private.lot_remaining(p_lot_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(delta), 0)::integer from public.credit_ledger where lot_id = p_lot_id;
$$;

-- Lot à débiter pour une séance : couvre la discipline, encore valide, du lot qui expire le
-- premier au plus récent. p_at : instant de référence (maintenant, ou date d'un mouvement passé).
create function private.pick_credit_lot(p_member_id uuid, p_discipline_id uuid, p_at timestamptz)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.id
  from public.credit_ledger l
  where l.member_id = p_member_id
    and l.lot_id = l.id
    and l.created_at <= p_at
    and (l.expires_at is null or l.expires_at > p_at)
    and (p_discipline_id is null or private.plan_covers(l.plan_id, p_discipline_id))
    and private.lot_remaining(l.id) > 0
  order by l.expires_at nulls last, l.created_at, l.id
  limit 1;
$$;

-- Rattache chaque mouvement à son lot.
create function private.credit_ledger_assign_lot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discipline uuid;
begin
  if new.lot_id is not null then
    return new;
  end if;
  if new.delta > 0 and new.reason in ('purchase', 'renewal', 'manual_adjustment') then
    new.lot_id := new.id;
  elsif new.reason = 'booking_refund' then
    -- Le crédit rendu retourne dans le lot débité.
    select lot_id into new.lot_id from public.credit_ledger
    where booking_id = new.booking_id and reason = 'booking'
    order by created_at desc limit 1;
  elsif new.reason = 'booking' then
    select s.discipline_id into v_discipline
    from public.bookings b join public.class_sessions s on s.id = b.session_id
    where b.id = new.booking_id;
    new.lot_id := coalesce(
      private.pick_credit_lot(new.member_id, v_discipline, new.created_at),
      -- Filet de sécurité (données anciennes) : n'importe quel lot restant.
      private.pick_credit_lot(new.member_id, null, new.created_at)
    );
  end if;
  return new;
end;
$$;

create trigger credit_ledger_assign_lot before insert on public.credit_ledger
  for each row execute function private.credit_ledger_assign_lot();

-- Reprise des données existantes : lots, puis mouvements dans l'ordre chronologique.
do $$
declare
  v_row public.credit_ledger;
  v_lot uuid;
  v_discipline uuid;
begin
  update public.credit_ledger
  set lot_id = id
  where delta > 0 and reason in ('purchase', 'renewal', 'manual_adjustment');

  for v_row in
    select * from public.credit_ledger where lot_id is null order by created_at, id
  loop
    if v_row.reason = 'booking_refund' then
      select lot_id into v_lot from public.credit_ledger
      where booking_id = v_row.booking_id and reason = 'booking' limit 1;
    else
      select s.discipline_id into v_discipline
      from public.bookings b join public.class_sessions s on s.id = b.session_id
      where b.id = v_row.booking_id;
      v_lot := coalesce(
        private.pick_credit_lot(v_row.member_id, v_discipline, v_row.created_at),
        private.pick_credit_lot(v_row.member_id, null, v_row.created_at)
      );
    end if;
    update public.credit_ledger set lot_id = v_lot where id = v_row.id;
  end loop;
end;
$$;

-- Crédits utilisables pour une discipline, maintenant.
create function private.credits_for(p_member_id uuid, p_discipline_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(private.lot_remaining(l.id)), 0)::integer
  from public.credit_ledger l
  where l.member_id = p_member_id
    and l.lot_id = l.id
    and (l.expires_at is null or l.expires_at > now())
    and private.plan_covers(l.plan_id, p_discipline_id);
$$;

-- Expiration : le restant d'un lot échu sort du solde (job quotidien).
create function private.expire_credits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lot record;
  v_count integer := 0;
begin
  for v_lot in
    select l.*, private.lot_remaining(l.id) as remaining
    from public.credit_ledger l
    where l.lot_id = l.id and l.expires_at is not null and l.expires_at <= now()
  loop
    if v_lot.remaining > 0 then
      insert into public.credit_ledger (gym_id, member_id, delta, reason, lot_id, plan_id, note)
      values (v_lot.gym_id, v_lot.member_id, -v_lot.remaining, 'expiration', v_lot.id, v_lot.plan_id,
              'Crédits expirés');
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accès aux cours
-- ---------------------------------------------------------------------------

-- Abonnement en cours qui couvre la discipline. Un abonnement Stripe suit son statut (le
-- webhook le tient à jour) ; un abonnement suivi à la main s'arrête à la fin de sa période.
create function private.subscription_covers(p_member_id uuid, p_discipline_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.member_id = p_member_id
      and s.status in ('active', 'trialing')
      and (s.stripe_subscription_id is not null
           or s.current_period_end is null or s.current_period_end > now())
      and private.plan_covers(s.plan_id, p_discipline_id)
  );
$$;

-- Abonnement en cours, quelle que soit la discipline (affichage, statistiques).
create or replace function private.has_active_subscription(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.member_id = p_member_id
      and s.status in ('active', 'trialing')
      and (s.stripe_subscription_id is not null
           or s.current_period_end is null or s.current_period_end > now())
  );
$$;

-- Pourquoi l'adhérent ne peut-il pas occuper une place de cette séance ? (null : il peut)
create function private.seat_denial(p_member_id uuid, p_session_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_discipline uuid;
begin
  if not exists (select 1 from public.members where id = p_member_id and status = 'active') then
    return 'member_not_active';
  end if;
  select discipline_id into v_discipline from public.class_sessions where id = p_session_id;
  if private.subscription_covers(p_member_id, v_discipline)
    or private.credits_for(p_member_id, v_discipline) >= 1 then
    return null;
  end if;
  -- Un abonnement ou des crédits existent, mais pour d'autres disciplines.
  if private.has_active_subscription(p_member_id) or private.credit_balance(p_member_id) >= 1 then
    return 'plan_discipline';
  end if;
  return 'no_credit';
end;
$$;

drop function private.can_take_seat(uuid);
create function private.can_take_seat(p_member_id uuid, p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.seat_denial(p_member_id, p_session_id) is null;
$$;

-- Débite 1 crédit (lot choisi par le trigger) si aucun abonnement ne couvre la discipline.
create or replace function private.debit_seat(p_booking public.bookings)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discipline uuid;
begin
  select discipline_id into v_discipline from public.class_sessions where id = p_booking.session_id;
  if not private.subscription_covers(p_booking.member_id, v_discipline) then
    insert into public.credit_ledger (gym_id, member_id, delta, reason, booking_id, created_by)
    values (p_booking.gym_id, p_booking.member_id, -1, 'booking', p_booking.id, auth.uid());
  end if;
end;
$$;

-- Liste d'attente : même règle d'accès, discipline comprise.
create or replace function private.promote_waitlist(p_session_id uuid)
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

    if private.can_take_seat(v_candidate.member_id, p_session_id) then
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

-- Réservation : refus expliqué si l'offre ne couvre pas la discipline (plan_discipline).
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
  v_denial text;
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

  v_denial := private.seat_denial(v_member.id, v_session.id);
  if v_denial is not null then
    raise exception '%', v_denial;
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

-- Retrait manuel : pris sur les lots dans l'ordre d'expiration (une ligne par lot touché).
create or replace function public.adjust_credits(p_member_id uuid, p_delta integer, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_left integer;
  v_lot record;
  v_take integer;
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
  if p_delta > 0 then
    insert into public.credit_ledger (gym_id, member_id, delta, reason, note, created_by)
    values (v_member.gym_id, v_member.id, p_delta, 'manual_adjustment',
            coalesce(v_note, 'Ajout manuel (back office)'), (select auth.uid()));
    return private.credit_balance(v_member.id);
  end if;

  if not private.gym_setting_bool(v_member.gym_id, 'manager_can_remove_credits') then
    raise exception 'strategy_disabled';
  end if;
  if v_note is null then
    raise exception 'reason_required';
  end if;
  if private.credit_balance(v_member.id) + p_delta < 0 then
    raise exception 'insufficient_credits';
  end if;

  v_left := -p_delta;
  for v_lot in
    select l.id, l.plan_id, private.lot_remaining(l.id) as remaining
    from public.credit_ledger l
    where l.member_id = v_member.id and l.lot_id = l.id
    order by l.expires_at nulls last, l.created_at, l.id
  loop
    exit when v_left = 0;
    continue when v_lot.remaining <= 0;
    v_take := least(v_left, v_lot.remaining);
    insert into public.credit_ledger (gym_id, member_id, delta, reason, note, created_by, lot_id, plan_id)
    values (v_member.gym_id, v_member.id, -v_take, 'manual_adjustment', v_note, (select auth.uid()),
            v_lot.id, v_lot.plan_id);
    v_left := v_left - v_take;
  end loop;
  -- Solde ancien sans lot (données d'avant les lots) : retiré tel quel.
  if v_left > 0 then
    insert into public.credit_ledger (gym_id, member_id, delta, reason, note, created_by)
    values (v_member.gym_id, v_member.id, -v_left, 'manual_adjustment', v_note, (select auth.uid()));
  end if;
  return private.credit_balance(v_member.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Prix et codes promo
-- ---------------------------------------------------------------------------

-- Code promo valide pour l'offre (null si aucun code), ou erreur explicite.
create function private.resolve_promo(p_gym_id uuid, p_code text, p_plan_id uuid)
returns public.promo_codes
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_promo public.promo_codes;
  v_today date;
begin
  if nullif(btrim(coalesce(p_code, '')), '') is null then
    return null;
  end if;
  select (now() at time zone timezone)::date into v_today from public.gyms where id = p_gym_id;
  select * into v_promo from public.promo_codes
  where gym_id = p_gym_id and code = upper(btrim(p_code));
  if not found or not v_promo.is_active
    or (v_promo.starts_on is not null and v_today < v_promo.starts_on)
    or (v_promo.ends_on is not null and v_today > v_promo.ends_on)
    or (exists (select 1 from public.promo_code_plans where promo_code_id = v_promo.id)
        and not exists (
          select 1 from public.promo_code_plans
          where promo_code_id = v_promo.id and plan_id = p_plan_id
        )) then
    raise exception 'promo_invalid';
  end if;
  if v_promo.max_redemptions is not null and (
    select count(*) from public.payments
    where promo_code_id = v_promo.id and status in ('pending', 'succeeded')
  ) >= v_promo.max_redemptions then
    raise exception 'promo_exhausted';
  end if;
  return v_promo;
end;
$$;

-- Prix après remise (jamais négatif).
create function private.discounted_price(p_price integer, p_promo public.promo_codes)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_promo.id is null then p_price
    when p_promo.kind = 'percent' then greatest(0, round(p_price * (100 - p_promo.value) / 100.0)::integer)
    else greatest(0, p_price - p_promo.value)
  end;
$$;

-- Qui peut vendre sur place : le gérant, ou l'accueil si la stratégie l'y autorise.
create function private.can_sell(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_gym_manager(p_gym_id)
    or (private.is_gym_staff(p_gym_id) and private.gym_setting_bool(p_gym_id, 'staff_can_sell'));
$$;

-- Prix d'une vente (aperçu en direct du panneau « Vente sur place »).
create function public.price_quote(p_plan_id uuid, p_promo_code text default null)
returns table (price_cents integer, final_cents integer, promo_code_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_promo public.promo_codes;
begin
  select * into v_plan from public.plans where id = p_plan_id;
  if not found then
    raise exception 'plan_not_found';
  end if;
  if not private.can_sell(v_plan.gym_id) then
    raise exception 'forbidden';
  end if;
  v_promo := private.resolve_promo(v_plan.gym_id, p_promo_code, v_plan.id);
  return query select v_plan.price_cents, private.discounted_price(v_plan.price_cents, v_promo), v_promo.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ventes sur place
-- ---------------------------------------------------------------------------

-- Fin de période d'un abonnement (mois ou année) à partir d'un instant.
create function private.period_end(p_start timestamptz, p_interval public.billing_interval)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_start + case p_interval when 'year' then interval '1 year' else interval '1 month' end;
$$;

-- Vente d'une offre : paiement encaissé, puis crédits (carnet, séance) ou abonnement suivi à
-- la main. Un prospect qui achète devient actif.
create function public.record_manual_sale(
  p_member_id uuid,
  p_plan_id uuid,
  p_method public.payment_method,
  p_promo_code text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_plan public.plans;
  v_promo public.promo_codes;
  v_payment public.payments;
begin
  select * into v_member from public.members where id = p_member_id for update;
  if not found then
    raise exception 'member_not_found';
  end if;
  if not private.can_sell(v_member.gym_id) then
    raise exception 'forbidden';
  end if;
  if p_method is null or p_method = 'sepa_debit' then
    raise exception 'invalid_input';
  end if;
  select * into v_plan from public.plans where id = p_plan_id and gym_id = v_member.gym_id;
  if not found then
    raise exception 'plan_not_found';
  end if;
  if not v_plan.is_active then
    raise exception 'plan_inactive';
  end if;
  if v_member.status in ('suspended', 'cancelled') then
    raise exception 'member_not_active';
  end if;
  if v_plan.type = 'recurring' and private.has_active_subscription(v_member.id) then
    raise exception 'already_subscribed';
  end if;

  v_promo := private.resolve_promo(v_member.gym_id, p_promo_code, v_plan.id);

  insert into public.payments (gym_id, member_id, amount_cents, currency, status, method,
                               description, paid_at, plan_id, promo_code_id, recorded_by)
  values (v_member.gym_id, v_member.id, private.discounted_price(v_plan.price_cents, v_promo),
          v_plan.currency, 'succeeded', p_method, v_plan.name, now(), v_plan.id, v_promo.id,
          (select auth.uid()))
  returning * into v_payment;

  if v_plan.type = 'recurring' then
    insert into public.subscriptions (gym_id, member_id, plan_id, status, started_at,
                                      current_period_start, current_period_end, commitment_ends_at)
    values (v_member.gym_id, v_member.id, v_plan.id, 'active', now(), now(),
            private.period_end(now(), v_plan.billing_interval),
            case when v_plan.commitment_months is not null
                 then now() + make_interval(months => v_plan.commitment_months) end);
  else
    insert into public.credit_ledger (gym_id, member_id, delta, reason, payment_id, plan_id,
                                      expires_at, note, created_by)
    values (v_member.gym_id, v_member.id, v_plan.credits, 'purchase', v_payment.id, v_plan.id,
            case when v_plan.validity_days is not null
                 then now() + make_interval(days => v_plan.validity_days) end,
            v_plan.name, (select auth.uid()));
  end if;

  if v_member.status = 'prospect' then
    update public.members set status = 'active' where id = v_member.id;
  end if;
  return v_payment;
end;
$$;

-- Renouvellement d'un abonnement suivi à la main : une période de plus, payée sur place.
create function public.renew_manual_subscription(p_subscription_id uuid, p_method public.payment_method)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_plan public.plans;
  v_start timestamptz;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'subscription_not_found';
  end if;
  if not private.can_sell(v_sub.gym_id) then
    raise exception 'forbidden';
  end if;
  if v_sub.stripe_subscription_id is not null or v_sub.cancel_at is not null
    or v_sub.status not in ('active', 'past_due') then
    raise exception 'not_renewable';
  end if;
  if p_method is null or p_method = 'sepa_debit' then
    raise exception 'invalid_input';
  end if;
  select * into v_plan from public.plans where id = v_sub.plan_id;

  insert into public.payments (gym_id, member_id, amount_cents, currency, status, method,
                               description, paid_at, plan_id, recorded_by)
  values (v_sub.gym_id, v_sub.member_id, v_plan.price_cents, v_plan.currency, 'succeeded',
          p_method, v_plan.name || ' (renouvellement)', now(), v_plan.id, (select auth.uid()));

  -- La nouvelle période suit la précédente, ou part d'aujourd'hui après un retard.
  v_start := greatest(coalesce(v_sub.current_period_end, now()), now());
  update public.subscriptions
  set status = 'active',
      current_period_start = v_start,
      current_period_end = private.period_end(v_start, v_plan.billing_interval)
  where id = v_sub.id
  returning * into v_sub;
  return v_sub;
end;
$$;

-- Fin d'un abonnement suivi à la main : il court jusqu'au bout de la période payée.
create function public.cancel_manual_subscription(p_subscription_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'subscription_not_found';
  end if;
  if not private.is_gym_manager(v_sub.gym_id) then
    raise exception 'forbidden';
  end if;
  if v_sub.stripe_subscription_id is not null or v_sub.status in ('canceled', 'incomplete_expired') then
    raise exception 'not_renewable';
  end if;
  update public.subscriptions
  set cancel_at = coalesce(current_period_end, now()), canceled_at = now(),
      status = case when coalesce(current_period_end, now()) <= now() then 'canceled'::public.subscription_status
                    else status end
  where id = v_sub.id
  returning * into v_sub;
  return v_sub;
end;
$$;

-- Échéances des abonnements suivis à la main (job quotidien) : une fin programmée termine
-- l'abonnement ; une période non renouvelée passe en impayé (accès suspendu, à relancer).
create function private.close_manual_periods()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.subscriptions
  set status = case when cancel_at is not null then 'canceled'::public.subscription_status
                    else 'past_due'::public.subscription_status end
  where stripe_subscription_id is null
    and status in ('active', 'trialing')
    and current_period_end is not null and current_period_end <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

select cron.schedule('billing-daily', '15 3 * * *',
  'select private.expire_credits(); select private.close_manual_periods();');

-- ---------------------------------------------------------------------------
-- Indicateurs financiers (gérant)
-- ---------------------------------------------------------------------------

alter function public.gym_kpis(uuid, date, date) rename to gym_kpis_base;
alter function public.gym_kpis_base(uuid, date, date) set schema private;
revoke all on function private.gym_kpis_base(uuid, date, date) from public, anon, authenticated;

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
begin
  -- Droits et période vérifiés par la fonction de base.
  select timezone into v_tz from public.gyms where id = p_gym_id;
  v_from := p_from::timestamp at time zone v_tz;
  v_to := (p_to + 1)::timestamp at time zone v_tz;
  return private.gym_kpis_base(p_gym_id, p_from, p_to) || jsonb_build_object(
    'revenue_cents', (
      select coalesce(sum(amount_cents), 0) from public.payments
      where gym_id = p_gym_id and status = 'succeeded' and paid_at >= v_from and paid_at < v_to
    ),
    'failed_payments', (
      select count(*) from public.payments
      where gym_id = p_gym_id and status = 'failed' and created_at >= v_from and created_at < v_to
    ),
    -- Revenu mensuel récurrent : abonnements en cours, ramenés au mois.
    'mrr_cents', (
      select coalesce(sum(case p.billing_interval when 'year' then round(p.price_cents / 12.0)
                                                 else p.price_cents end), 0)::integer
      from public.subscriptions s join public.plans p on p.id = s.plan_id
      where s.gym_id = p_gym_id and s.status in ('active', 'trialing')
        and (s.stripe_subscription_id is not null
             or s.current_period_end is null or s.current_period_end > now())
    ),
    'active_subscriptions', (
      select count(*) from public.subscriptions s
      where s.gym_id = p_gym_id and s.status in ('active', 'trialing')
        and (s.stripe_subscription_id is not null
             or s.current_period_end is null or s.current_period_end > now())
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------

revoke all on function
  private.plan_covers(uuid, uuid),
  private.lot_remaining(uuid),
  private.pick_credit_lot(uuid, uuid, timestamptz),
  private.credit_ledger_assign_lot(),
  private.credits_for(uuid, uuid),
  private.expire_credits(),
  private.subscription_covers(uuid, uuid),
  private.seat_denial(uuid, uuid),
  private.can_take_seat(uuid, uuid),
  private.resolve_promo(uuid, text, uuid),
  private.discounted_price(integer, public.promo_codes),
  private.can_sell(uuid),
  private.period_end(timestamptz, public.billing_interval),
  private.close_manual_periods()
from public, anon, authenticated;

revoke all on function
  public.price_quote(uuid, text),
  public.record_manual_sale(uuid, uuid, public.payment_method, text),
  public.renew_manual_subscription(uuid, public.payment_method),
  public.cancel_manual_subscription(uuid),
  public.gym_kpis(uuid, date, date)
from public, anon;
grant execute on function
  public.price_quote(uuid, text),
  public.record_manual_sale(uuid, uuid, public.payment_method, text),
  public.renew_manual_subscription(uuid, public.payment_method),
  public.cancel_manual_subscription(uuid),
  public.gym_kpis(uuid, date, date)
to authenticated;
