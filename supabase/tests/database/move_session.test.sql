-- Déplacement d'une séance : droits, réservations conservées, inscrits prévenus, aperçu.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('50000000-0000-0000-0000-000000000001', 'm-membre@test.local'),
  ('50000000-0000-0000-0000-000000000002', 'm-gerant@test.local'),
  ('50000000-0000-0000-0000-000000000003', 'm-accueil@test.local'),
  ('50000000-0000-0000-0000-000000000004', 'm-gerant-autre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('9a000000-0000-0000-0000-000000000000', 'Salle M', 'salle-m', 'Europe/Paris'),
  ('9b000000-0000-0000-0000-000000000000', 'Salle N', 'salle-n', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('9a000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000002', 'manager'),
  ('9a000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000003', 'staff'),
  ('9b000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000004', 'manager');
insert into public.members (id, gym_id, profile_id, first_name, last_name, status) values
  ('91000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000001', 'Membre', 'M', 'active');
insert into public.credit_ledger (gym_id, member_id, delta, reason) values
  ('9a000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000001', 1, 'purchase');
insert into public.disciplines (id, gym_id, name, color) values
  ('94000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000000', 'Renfo', '#2563eb');
insert into public.coaches (id, gym_id, display_name) values
  ('95000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000000', 'Coach M');
insert into public.class_sessions (id, gym_id, discipline_id, coach_id, starts_at, ends_at, capacity, status) values
  -- s1 : 12/03/2030 18 h 30 (Paris), 45 min. s2 : même coach le 13/03 à 9 h. s3 : commencée.
  ('96000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000000', '94000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', '2030-03-12 17:30:00+00', '2030-03-12 18:15:00+00', 5, 'scheduled'),
  ('96000000-0000-0000-0000-000000000002', '9a000000-0000-0000-0000-000000000000', '94000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', '2030-03-13 08:00:00+00', '2030-03-13 09:00:00+00', 5, 'scheduled'),
  ('96000000-0000-0000-0000-000000000003', '9a000000-0000-0000-0000-000000000000', '94000000-0000-0000-0000-000000000001', null, now() - interval '10 minutes', now() + interval '50 minutes', 5, 'scheduled');
insert into public.coach_shifts (gym_id, coach_id, session_id, starts_at, ends_at) values
  ('9a000000-0000-0000-0000-000000000000', '95000000-0000-0000-0000-000000000001', '96000000-0000-0000-0000-000000000001', '2030-03-12 17:30:00+00', '2030-03-12 18:15:00+00');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select pg_temp.login_as('50000000-0000-0000-0000-000000000001');
select public.book_session('96000000-0000-0000-0000-000000000001');

select pg_temp.login_as('50000000-0000-0000-0000-000000000003');
select throws_ok($$select public.move_session('96000000-0000-0000-0000-000000000001', '2030-03-13 08:30:00+00')$$,
  'P0001', 'forbidden', 'l''accueil ne déplace pas une séance');
select pg_temp.login_as('50000000-0000-0000-0000-000000000004');
select throws_ok($$select public.move_session('96000000-0000-0000-0000-000000000001', '2030-03-13 08:30:00+00')$$,
  'P0001', 'forbidden', 'un gérant d''une autre salle ne déplace pas');

select pg_temp.login_as('50000000-0000-0000-0000-000000000002');
select is((select booked from public.session_move_preview('96000000-0000-0000-0000-000000000001', '2030-03-13 08:30:00+00')),
  1, 'aperçu : inscrits à prévenir');
select ok((select coach_conflict from public.session_move_preview('96000000-0000-0000-0000-000000000001', '2030-03-13 08:30:00+00')),
  'aperçu : chevauchement du coach signalé');
select ok(not (select coach_conflict from public.session_move_preview('96000000-0000-0000-0000-000000000001', '2030-03-14 08:30:00+00')),
  'aperçu : pas de chevauchement ailleurs');
select throws_ok($$select public.move_session('96000000-0000-0000-0000-000000000003', '2030-03-13 08:30:00+00')$$,
  'P0001', 'session_started', 'séance commencée : pas de déplacement');
select throws_ok($$select public.move_session('96000000-0000-0000-0000-000000000001', now() - interval '1 hour')$$,
  'P0001', 'invalid_period', 'pas de déplacement dans le passé');

select is((public.move_session('96000000-0000-0000-0000-000000000001', '2030-03-14 06:00:00+00')).ends_at,
  '2030-03-14 06:45:00+00'::timestamptz, 'déplacée en gardant sa durée');
select pg_temp.logout();
select is((select status from public.bookings where session_id = '96000000-0000-0000-0000-000000000001'),
  'confirmed'::public.booking_status, 'réservation conservée');
select is((select subject from public.outbound_messages where origin = 'session_moved' and member_id = '91000000-0000-0000-0000-000000000001'),
  'Séance déplacée : Renfo du 14/03 à 7h', 'inscrit prévenu du nouvel horaire');
select ok((select body like '%Renfo du 12/03 à 18h30%' from public.outbound_messages where origin = 'session_moved' and member_id = '91000000-0000-0000-0000-000000000001'),
  'le message rappelle l''ancien créneau');
select is((select starts_at from public.coach_shifts where session_id = '96000000-0000-0000-0000-000000000001'),
  '2030-03-14 06:00:00+00'::timestamptz, 'créneau du coach déplacé avec la séance');

select pg_temp.login_as('50000000-0000-0000-0000-000000000002');
select is((select count(*) from (select public.move_session('96000000-0000-0000-0000-000000000001', '2030-03-14 06:00:00+00')) x)::integer,
  1, 'même créneau : sans effet');
select pg_temp.logout();

select * from finish();
rollback;
