-- Cœur de réservation (phase 1) : book_session, cancel_booking, set_attendance,
-- cancel_session, generate_sessions, join_gym. Les tests créent leurs propres données
-- (salle G, limite de 3 réservations à venir) et ne dépendent pas du seed.
begin;
select plan(46);

-- ---------------------------------------------------------------------------
-- Données de test
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'b1@test.local'),
  ('10000000-0000-0000-0000-000000000002', 'b2@test.local'),
  ('10000000-0000-0000-0000-000000000003', 'b3@test.local'),
  ('10000000-0000-0000-0000-000000000004', 'b4@test.local'),
  ('10000000-0000-0000-0000-000000000005', 'pack@test.local'),
  ('10000000-0000-0000-0000-000000000006', 'prospect@test.local'),
  ('10000000-0000-0000-0000-000000000007', 'autre-salle@test.local'),
  ('10000000-0000-0000-0000-000000000008', 'coach@test.local'),
  ('10000000-0000-0000-0000-000000000009', 'accueil@test.local'),
  ('10000000-0000-0000-0000-00000000000a', 'gerant@test.local'),
  ('10000000-0000-0000-0000-00000000000b', 'nouveau@test.local'),
  ('10000000-0000-0000-0000-00000000000c', 'Deja.Connu@test.local');

insert into public.gyms (id, name, slug, settings) values
  ('ca000000-0000-0000-0000-000000000000', 'Salle G', 'salle-g', '{"max_upcoming_bookings": 3}'),
  ('cb000000-0000-0000-0000-000000000000', 'Salle H', 'salle-h', '{}');

insert into public.gym_roles (gym_id, profile_id, role) values
  ('ca000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000008', 'coach'),
  ('ca000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000009', 'staff'),
  ('ca000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-00000000000a', 'manager');

insert into public.members (id, gym_id, profile_id, first_name, last_name, status) values
  ('c1000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'Un', 'B', 'active'),
  ('c1000000-0000-0000-0000-000000000002', 'ca000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'Deux', 'B', 'active'),
  ('c1000000-0000-0000-0000-000000000003', 'ca000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'Trois', 'B', 'active'),
  ('c1000000-0000-0000-0000-000000000004', 'ca000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'Quatre', 'B', 'active'),
  ('c1000000-0000-0000-0000-000000000005', 'ca000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'Carnet', 'B', 'active'),
  ('c1000000-0000-0000-0000-000000000006', 'ca000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000006', 'Prospect', 'B', 'prospect'),
  ('c2000000-0000-0000-0000-000000000007', 'cb000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000007', 'Ailleurs', 'H', 'active');

insert into public.plans (id, gym_id, name, type, price_cents, billing_interval) values
  ('c3000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000000', 'Illimité', 'recurring', 9900, 'month'),
  ('c3000000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-000000000000', 'Illimité H', 'recurring', 9900, 'month');

insert into public.subscriptions (gym_id, member_id, plan_id, status)
select 'ca000000-0000-0000-0000-000000000000', id, 'c3000000-0000-0000-0000-000000000001', 'active'
from public.members where gym_id = 'ca000000-0000-0000-0000-000000000000' and last_name = 'B'
  and first_name in ('Un', 'Deux', 'Trois', 'Quatre');
insert into public.subscriptions (gym_id, member_id, plan_id, status) values
  ('cb000000-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000007', 'c3000000-0000-0000-0000-000000000002', 'active');

-- Carnet : un seul crédit, pas d'abonnement.
insert into public.credit_ledger (gym_id, member_id, delta, reason) values
  ('ca000000-0000-0000-0000-000000000000', 'c1000000-0000-0000-0000-000000000005', 1, 'purchase');

insert into public.disciplines (id, gym_id, name, color) values
  ('c4000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000000', 'CrossFit', '#dc2626'),
  ('c4000000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-000000000000', 'Hyrox', '#f59e0b');

insert into public.coaches (id, gym_id, profile_id, display_name) values
  ('c5000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000008', 'Coach G');

-- s1 : 2 places. s2 à s4 : 5 places. Une séance commencée, une annulée, une dans la salle H.
insert into public.class_sessions (id, gym_id, discipline_id, coach_id, starts_at, ends_at, capacity, status) values
  ('c6000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000000', 'c4000000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', now() + interval '1 day', now() + interval '1 day 1 hour', 2, 'scheduled'),
  ('c6000000-0000-0000-0000-000000000002', 'ca000000-0000-0000-0000-000000000000', 'c4000000-0000-0000-0000-000000000001', null, now() + interval '2 days', now() + interval '2 days 1 hour', 5, 'scheduled'),
  ('c6000000-0000-0000-0000-000000000003', 'ca000000-0000-0000-0000-000000000000', 'c4000000-0000-0000-0000-000000000001', null, now() + interval '3 days', now() + interval '3 days 1 hour', 5, 'scheduled'),
  ('c6000000-0000-0000-0000-000000000004', 'ca000000-0000-0000-0000-000000000000', 'c4000000-0000-0000-0000-000000000001', null, now() + interval '4 days', now() + interval '4 days 1 hour', 5, 'scheduled'),
  ('c6000000-0000-0000-0000-000000000005', 'ca000000-0000-0000-0000-000000000000', 'c4000000-0000-0000-0000-000000000001', null, now() - interval '30 minutes', now() + interval '30 minutes', 5, 'scheduled'),
  ('c6000000-0000-0000-0000-000000000006', 'ca000000-0000-0000-0000-000000000000', 'c4000000-0000-0000-0000-000000000001', null, now() + interval '5 days', now() + interval '5 days 1 hour', 5, 'cancelled'),
  ('c6000000-0000-0000-0000-000000000007', 'cb000000-0000-0000-0000-000000000000', 'c4000000-0000-0000-0000-000000000002', null, now() + interval '1 day', now() + interval '1 day 1 hour', 5, 'scheduled');

-- Cours récurrent du lundi pour generate_sessions.
insert into public.class_templates (id, gym_id, discipline_id, weekday, start_time, duration_minutes, capacity, starts_on) values
  ('c7000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000000', 'c4000000-0000-0000-0000-000000000001', 1, '18:30', 60, 12, current_date);

-- Prospect connu (même email qu'un futur compte) dans la salle utilisée par join_gym.
insert into public.members (id, gym_id, first_name, last_name, email, status)
select 'c1000000-0000-0000-0000-0000000000cc', id, 'Déjà', 'Connu', 'deja.connu@test.local', 'prospect'
from public.gyms order by created_at, id limit 1;

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.booking_of(p_member uuid, p_session uuid) returns public.bookings language sql as $$
  select * from public.bookings where member_id = p_member and session_id = p_session and status <> 'cancelled';
$$;

-- ---------------------------------------------------------------------------
-- Places, liste d'attente
-- ---------------------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
select is((public.book_session('c6000000-0000-0000-0000-000000000001')).status, 'confirmed', 'place libre : réservation confirmée');
select throws_ok($$select public.book_session('c6000000-0000-0000-0000-000000000001')$$, 'P0001', 'already_booked', 'pas deux réservations sur la même séance');

select pg_temp.login_as('10000000-0000-0000-0000-000000000002');
select is((public.book_session('c6000000-0000-0000-0000-000000000001')).status, 'confirmed', 'deuxième place confirmée');

select pg_temp.login_as('10000000-0000-0000-0000-000000000003');
select is((public.book_session('c6000000-0000-0000-0000-000000000001')).waitlist_position, 1, 'séance pleine : liste d''attente, position 1');

select pg_temp.login_as('10000000-0000-0000-0000-000000000004');
select is((public.book_session('c6000000-0000-0000-0000-000000000001')).waitlist_position, 2, 'liste d''attente, position 2');

select pg_temp.logout();
select results_eq(
  $$select booked_count, waitlist_count from public.class_sessions where id = 'c6000000-0000-0000-0000-000000000001'$$,
  $$values (2, 2)$$,
  'compteurs de la séance à jour'
);

-- ---------------------------------------------------------------------------
-- Refus
-- ---------------------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000006');
select throws_ok($$select public.book_session('c6000000-0000-0000-0000-000000000002')$$, 'P0001', 'member_not_active', 'un prospect ne réserve pas');

select pg_temp.login_as('10000000-0000-0000-0000-000000000002');
select throws_ok($$select public.book_session('c6000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000005')$$, 'P0001', 'forbidden', 'un adhérent ne réserve pas pour un autre');

select pg_temp.login_as('10000000-0000-0000-0000-000000000007');
select throws_ok($$select public.book_session('c6000000-0000-0000-0000-000000000002')$$, 'P0001', 'not_a_member', 'un adhérent d''une autre salle ne réserve pas');

select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
select throws_ok($$select public.book_session('c6000000-0000-0000-0000-000000000005')$$, 'P0001', 'session_started', 'séance commencée : réservation refusée');
select throws_ok($$select public.book_session('c6000000-0000-0000-0000-000000000006')$$, 'P0001', 'session_cancelled', 'séance annulée : réservation refusée');

select pg_temp.logout();
select throws_ok(
  $$set local role anon; select public.book_session('c6000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'un visiteur non connecté ne réserve pas'
);
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Annulation et promotion
-- ---------------------------------------------------------------------------
-- Identifiant lu avant la connexion : la RLS masque la réservation d'autrui.
select set_config('test.booking_b4', (pg_temp.booking_of('c1000000-0000-0000-0000-000000000004', 'c6000000-0000-0000-0000-000000000001')).id::text, true);
select pg_temp.login_as('10000000-0000-0000-0000-000000000002');
select throws_ok(
  format('select public.cancel_booking(%L)', current_setting('test.booking_b4')),
  'P0001', 'forbidden', 'un adhérent n''annule pas la réservation d''un autre'
);

select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
select is(
  (public.cancel_booking((pg_temp.booking_of('c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001')).id)).status,
  'cancelled', 'l''adhérent annule sa réservation'
);

select pg_temp.logout();
select is((pg_temp.booking_of('c1000000-0000-0000-0000-000000000003', 'c6000000-0000-0000-0000-000000000001')).status, 'confirmed', 'le premier de la liste d''attente est promu');
select is((pg_temp.booking_of('c1000000-0000-0000-0000-000000000004', 'c6000000-0000-0000-0000-000000000001')).waitlist_position, 1, 'la file est renumérotée');
select results_eq(
  $$select booked_count, waitlist_count from public.class_sessions where id = 'c6000000-0000-0000-0000-000000000001'$$,
  $$values (2, 1)$$,
  'compteurs à jour après promotion'
);

-- ---------------------------------------------------------------------------
-- Crédits (carnet sans abonnement)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000005');
select is((public.book_session('c6000000-0000-0000-0000-000000000002')).status, 'confirmed', 'carnet : réservation confirmée');
select pg_temp.logout();
select is(private.credit_balance('c1000000-0000-0000-0000-000000000005'), 0, 'carnet : un crédit débité');

select pg_temp.login_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$select public.book_session('c6000000-0000-0000-0000-000000000003')$$, 'P0001', 'no_credit', 'carnet vide : réservation refusée');
select lives_ok(
  format('select public.cancel_booking(%L)', (pg_temp.booking_of('c1000000-0000-0000-0000-000000000005', 'c6000000-0000-0000-0000-000000000002')).id),
  'carnet : annulation'
);
select pg_temp.logout();
select is(private.credit_balance('c1000000-0000-0000-0000-000000000005'), 1, 'carnet : crédit rendu à l''annulation');

-- ---------------------------------------------------------------------------
-- Limite de réservations à venir (3 dans la salle G)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000002');
select lives_ok($$select public.book_session('c6000000-0000-0000-0000-000000000002')$$, '2e réservation à venir');
select lives_ok($$select public.book_session('c6000000-0000-0000-0000-000000000003')$$, '3e réservation à venir');
select throws_ok($$select public.book_session('c6000000-0000-0000-0000-000000000004')$$, 'P0001', 'max_upcoming_reached', 'au-delà de la limite : refus');

-- ---------------------------------------------------------------------------
-- Accueil : réservation pour un adhérent
-- ---------------------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000009');
select is((public.book_session('c6000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001')).status, 'confirmed', 'l''accueil réserve pour un adhérent');

-- ---------------------------------------------------------------------------
-- Pointage
-- ---------------------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
select throws_ok(
  format('select public.set_attendance(%L, %L)', (pg_temp.booking_of('c1000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000004')).id, 'attended'),
  'P0001', 'forbidden', 'un adhérent ne se pointe pas lui-même'
);
select pg_temp.login_as('10000000-0000-0000-0000-000000000008');
select is(
  (public.set_attendance((pg_temp.booking_of('c1000000-0000-0000-0000-000000000002', 'c6000000-0000-0000-0000-000000000001')).id, 'attended')).status,
  'attended', 'le coach pointe un présent dans sa séance'
);
select pg_temp.logout();
select isnt((pg_temp.booking_of('c1000000-0000-0000-0000-000000000002', 'c6000000-0000-0000-0000-000000000001')).checked_in_at, null, 'heure d''arrivée enregistrée');

-- ---------------------------------------------------------------------------
-- Promotion : un adhérent inéligible est sauté et garde sa place
-- ---------------------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000005');
select is((public.book_session('c6000000-0000-0000-0000-000000000001')).waitlist_position, 2, 'carnet en liste d''attente (crédit non débité)');
select pg_temp.logout();
update public.members set status = 'suspended' where id = 'c1000000-0000-0000-0000-000000000004';

select pg_temp.login_as('10000000-0000-0000-0000-000000000009');
select lives_ok(
  format('select public.cancel_booking(%L)', (pg_temp.booking_of('c1000000-0000-0000-0000-000000000003', 'c6000000-0000-0000-0000-000000000001')).id),
  'l''accueil annule une réservation'
);
select pg_temp.logout();
select is((pg_temp.booking_of('c1000000-0000-0000-0000-000000000005', 'c6000000-0000-0000-0000-000000000001')).status, 'confirmed', 'le suivant éligible est promu');
select is((pg_temp.booking_of('c1000000-0000-0000-0000-000000000004', 'c6000000-0000-0000-0000-000000000001')).waitlist_position, 1, 'l''inéligible reste premier de la file');
select is(private.credit_balance('c1000000-0000-0000-0000-000000000005'), 0, 'crédit débité à la promotion');

-- ---------------------------------------------------------------------------
-- Annulation d'une séance (gérant)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000009');
select throws_ok($$select public.cancel_session('c6000000-0000-0000-0000-000000000001', 'Panne')$$, 'P0001', 'forbidden', 'l''accueil n''annule pas une séance');
select pg_temp.login_as('10000000-0000-0000-0000-00000000000a');
select is((public.cancel_session('c6000000-0000-0000-0000-000000000001', 'Panne de chauffage')).status, 'cancelled', 'le gérant annule une séance');
select pg_temp.logout();
select is_empty(
  $$select id from public.bookings where session_id = 'c6000000-0000-0000-0000-000000000001' and status in ('confirmed', 'waitlisted')$$,
  'réservations actives annulées avec la séance'
);
select is(private.credit_balance('c1000000-0000-0000-0000-000000000005'), 1, 'crédit rendu à l''annulation de la séance');

-- ---------------------------------------------------------------------------
-- Génération des séances
-- ---------------------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000009');
select throws_ok($$select public.generate_sessions('ca000000-0000-0000-0000-000000000000', current_date + 1, current_date + 14)$$, 'P0001', 'forbidden', 'l''accueil ne génère pas les séances');
select pg_temp.login_as('10000000-0000-0000-0000-00000000000a');
select is(public.generate_sessions('ca000000-0000-0000-0000-000000000000', current_date + 1, current_date + 14), 2, '2 lundis sur 14 jours : 2 séances créées');
select is(public.generate_sessions('ca000000-0000-0000-0000-000000000000', current_date + 1, current_date + 14), 0, 'relancer ne crée pas de doublon');

-- ---------------------------------------------------------------------------
-- Inscription depuis l'app
-- ---------------------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-00000000000b');
select throws_ok($$select public.join_gym(false, true)$$, 'P0001', 'terms_not_accepted', 'CGV obligatoires');
select is((public.join_gym(true, true)).status, 'prospect', 'nouvelle inscription : fiche prospect');
select is(
  (public.join_gym(false, false)).id,
  (select id from public.members where profile_id = '10000000-0000-0000-0000-00000000000b'),
  'rappeler join_gym ne crée pas de doublon'
);
select pg_temp.logout();
select isnt_empty(
  $$select 1 from public.gym_roles where profile_id = '10000000-0000-0000-0000-00000000000b' and role = 'member'$$,
  'rôle member attribué'
);

select pg_temp.login_as('10000000-0000-0000-0000-00000000000c');
select is((public.join_gym(true, true)).id, 'c1000000-0000-0000-0000-0000000000cc'::uuid, 'prospect existant rattaché au compte par email');

select * from finish();
rollback;
