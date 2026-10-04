-- Coachs : options de remplacement, remplacement tracé et notifié, heures réalisées, RLS.
begin;
select plan(21);

insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000001', 'k-coach-a@test.local'),
  ('40000000-0000-0000-0000-000000000002', 'k-coach-b@test.local'),
  ('40000000-0000-0000-0000-000000000003', 'k-gerant@test.local'),
  ('40000000-0000-0000-0000-000000000004', 'k-accueil@test.local'),
  ('40000000-0000-0000-0000-000000000005', 'k-membre@test.local'),
  ('40000000-0000-0000-0000-000000000006', 'k-gerant-autre@test.local');

insert into public.gyms (id, name, slug, timezone) values
  ('fa000000-0000-0000-0000-000000000000', 'Salle K', 'salle-k', 'Europe/Paris'),
  ('fb000000-0000-0000-0000-000000000000', 'Salle L', 'salle-l', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('fa000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000001', 'coach'),
  ('fa000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000002', 'coach'),
  ('fa000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000003', 'manager'),
  ('fa000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000004', 'staff'),
  ('fb000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000006', 'manager');

insert into public.coaches (id, gym_id, profile_id, display_name) values
  ('f5000000-0000-0000-0000-00000000000a', 'fa000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000001', 'Coach A'),
  ('f5000000-0000-0000-0000-00000000000b', 'fa000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000002', 'Coach B'),
  ('f5000000-0000-0000-0000-00000000000c', 'fb000000-0000-0000-0000-000000000000', null, 'Coach Ailleurs');
insert into public.coach_compensations (coach_id, gym_id, employment_type, hourly_rate_cents) values
  ('f5000000-0000-0000-0000-00000000000a', 'fa000000-0000-0000-0000-000000000000', 'freelance', 3000),
  ('f5000000-0000-0000-0000-00000000000b', 'fa000000-0000-0000-0000-000000000000', 'freelance', 4000);

insert into public.disciplines (id, gym_id, name, color) values
  ('f4000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000000', 'Run', '#16a34a');
insert into public.coach_disciplines (gym_id, coach_id, discipline_id) values
  ('fa000000-0000-0000-0000-000000000000', 'f5000000-0000-0000-0000-00000000000b', 'f4000000-0000-0000-0000-000000000001');

-- Mardi 12 mars 2030, 18 h 30 – 19 h 30 à Paris (17 h 30 UTC). Coach B dispo le mardi 18 h – 20 h.
insert into public.coach_availabilities (gym_id, coach_id, weekday, start_time, end_time, valid_from) values
  ('fa000000-0000-0000-0000-000000000000', 'f5000000-0000-0000-0000-00000000000b', 2, '18:00', '20:00', '2030-01-01');

insert into public.members (id, gym_id, profile_id, first_name, last_name, status) values
  ('f1000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000005', 'Membre', 'K', 'active');
insert into public.credit_ledger (gym_id, member_id, delta, reason) values
  ('fa000000-0000-0000-0000-000000000000', 'f1000000-0000-0000-0000-000000000001', 1, 'purchase');

insert into public.class_sessions (id, gym_id, discipline_id, coach_id, starts_at, ends_at, capacity, status) values
  -- s1 : future, coach A. s2 : passée 60 min, coach A. s3 : passée 90 min, coach B.
  ('f6000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000000', 'f4000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-00000000000a', '2030-03-12 17:30:00+00', '2030-03-12 18:30:00+00', 5, 'scheduled'),
  ('f6000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000000', 'f4000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-00000000000a', '2026-02-10 17:00:00+00', '2026-02-10 18:00:00+00', 5, 'scheduled'),
  ('f6000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-000000000000', 'f4000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-00000000000b', '2026-02-11 17:00:00+00', '2026-02-11 18:30:00+00', 5, 'scheduled'),
  -- annulée : ne compte pas.
  ('f6000000-0000-0000-0000-000000000004', 'fa000000-0000-0000-0000-000000000000', 'f4000000-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-00000000000a', '2026-02-12 17:00:00+00', '2026-02-12 18:00:00+00', 5, 'cancelled');
insert into public.coach_shifts (gym_id, coach_id, session_id, starts_at, ends_at) values
  ('fa000000-0000-0000-0000-000000000000', 'f5000000-0000-0000-0000-00000000000a', 'f6000000-0000-0000-0000-000000000001', '2030-03-12 17:30:00+00', '2030-03-12 18:30:00+00');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.login_as('40000000-0000-0000-0000-000000000005');
select public.book_session('f6000000-0000-0000-0000-000000000001');

-- Options de remplacement
select throws_ok($$select * from public.session_coach_options('f6000000-0000-0000-0000-000000000001')$$,
  'P0001', 'forbidden', 'options : pas pour un adhérent');
select pg_temp.login_as('40000000-0000-0000-0000-000000000004');
select is((select count(*) from public.session_coach_options('f6000000-0000-0000-0000-000000000001')),
  2::bigint, 'options : coachs actifs de la salle seulement');
select ok((select available and teaches_discipline and not has_conflict from public.session_coach_options('f6000000-0000-0000-0000-000000000001') where display_name = 'Coach B'),
  'options : coach B disponible (heure de Paris) et compétent');
select ok((select is_current and not available from public.session_coach_options('f6000000-0000-0000-0000-000000000001') where display_name = 'Coach A'),
  'options : coach A actuel, sans disponibilité déclarée');

-- Remplacement
select throws_ok($$select public.update_session('f6000000-0000-0000-0000-000000000001', jsonb_build_object('coach_ids', jsonb_build_array('f5000000-0000-0000-0000-00000000000b')))$$,
  'P0001', 'forbidden', 'remplacement : pas par l''accueil');
select pg_temp.login_as('40000000-0000-0000-0000-000000000003');
select is(public.update_session('f6000000-0000-0000-0000-000000000001', jsonb_build_object('coach_ids', jsonb_build_array('f5000000-0000-0000-0000-00000000000a'))), 1, 'remplacement : même coach sans effet');
select throws_ok($$select public.update_session('f6000000-0000-0000-0000-000000000001', jsonb_build_object('coach_ids', jsonb_build_array('f5000000-0000-0000-0000-00000000000c')))$$,
  'P0001', 'coach_not_found', 'remplacement : coach d''une autre salle refusé');
select throws_ok($$select public.update_session('f6000000-0000-0000-0000-000000000002', jsonb_build_object('coach_ids', jsonb_build_array('f5000000-0000-0000-0000-00000000000b')))$$,
  'P0001', 'session_ended', 'remplacement : séance terminée refusée');
select is(public.update_session('f6000000-0000-0000-0000-000000000001', jsonb_build_object('coach_ids', jsonb_build_array('f5000000-0000-0000-0000-00000000000b'))), 1, 'remplacement : séance modifiée');
select is((select coach_id from public.class_sessions where id = 'f6000000-0000-0000-0000-000000000001'),
  'f5000000-0000-0000-0000-00000000000b'::uuid, 'remplacement : coach B anime la séance');
select pg_temp.logout();
select is((select status from public.coach_shifts where session_id = 'f6000000-0000-0000-0000-000000000001' and coach_id = 'f5000000-0000-0000-0000-00000000000a'),
  'cancelled'::public.shift_status, 'remplacement : créneau du coach A annulé');
select is((select replaced_coach_id from public.coach_shifts where session_id = 'f6000000-0000-0000-0000-000000000001' and coach_id = 'f5000000-0000-0000-0000-00000000000b'),
  'f5000000-0000-0000-0000-00000000000a'::uuid, 'remplacement : tracé avec le coach remplacé');
select is((select subject from public.outbound_messages where member_id = 'f1000000-0000-0000-0000-000000000001' and origin = 'session_moved'),
  'Séance modifiée : Run du 12/03 à 18h30', 'remplacement : inscrit prévenu (une seule fois)');

-- Heures réalisées
select pg_temp.login_as('40000000-0000-0000-0000-000000000003');
select is((select minutes from public.coach_hours('fa000000-0000-0000-0000-000000000000', '2026-02-01', '2026-02-28') where display_name = 'Coach A'),
  60, 'heures : séance annulée exclue');
select is((select amount_cents from public.coach_hours('fa000000-0000-0000-0000-000000000000', '2026-02-01', '2026-02-28') where display_name = 'Coach B'),
  6000::bigint, 'heures : 90 min × 40 € = 60 €');
select is((select sessions from public.coach_hours('fa000000-0000-0000-0000-000000000000', '2026-02-11', '2026-02-11') where display_name = 'Coach B'),
  1, 'heures : borne de fin incluse (journée civile)');
select is((select sum(sessions) from public.coach_hours('fa000000-0000-0000-0000-000000000000', '2030-03-01', '2030-03-31'))::integer,
  0, 'heures : séance à venir non comptée');
select pg_temp.login_as('40000000-0000-0000-0000-000000000001');
select is((select count(*) from public.coach_hours('fa000000-0000-0000-0000-000000000000', '2026-02-01', '2026-02-28')),
  1::bigint, 'heures : un coach ne voit que lui-même');
select pg_temp.login_as('40000000-0000-0000-0000-000000000004');
select is((select count(*) from public.coach_hours('fa000000-0000-0000-0000-000000000000', '2026-02-01', '2026-02-28')),
  0::bigint, 'heures : l''accueil ne voit rien');
select pg_temp.login_as('40000000-0000-0000-0000-000000000006');
select is((select count(*) from public.coach_hours('fa000000-0000-0000-0000-000000000000', '2026-02-01', '2026-02-28')),
  0::bigint, 'heures : un gérant d''une autre salle ne voit rien');

-- Disponibilités : le coach gère les siennes, pas celles d'un autre.
select pg_temp.login_as('40000000-0000-0000-0000-000000000001');
select lives_ok($$insert into public.coach_availabilities (gym_id, coach_id, weekday, start_time, end_time) values
  ('fa000000-0000-0000-0000-000000000000', 'f5000000-0000-0000-0000-00000000000a', 1, '07:00', '09:00')$$,
  'disponibilités : le coach ajoute un créneau');
select pg_temp.logout();

select * from finish();
rollback;
