-- « Tous présents » (set_attendance_many) et aperçu d'un changement de cours récurrent.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('51000000-0000-0000-0000-000000000001', 'st-gerant@test.local'),
  ('51000000-0000-0000-0000-000000000002', 'st-accueil@test.local'),
  ('51000000-0000-0000-0000-000000000003', 'st-membre@test.local'),
  ('51000000-0000-0000-0000-000000000004', 'st-autre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('5a000000-0000-0000-0000-000000000000', 'Salle ST', 'salle-st', 'Europe/Paris'),
  ('5b000000-0000-0000-0000-000000000000', 'Salle SU', 'salle-su', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('5a000000-0000-0000-0000-000000000000', '51000000-0000-0000-0000-000000000001', 'manager'),
  ('5a000000-0000-0000-0000-000000000000', '51000000-0000-0000-0000-000000000002', 'staff'),
  ('5a000000-0000-0000-0000-000000000000', '51000000-0000-0000-0000-000000000003', 'member'),
  ('5b000000-0000-0000-0000-000000000000', '51000000-0000-0000-0000-000000000004', 'manager');
insert into public.members (id, gym_id, first_name, last_name, status) values
  ('52000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000000', 'Ana', 'A', 'active'),
  ('52000000-0000-0000-0000-000000000002', '5a000000-0000-0000-0000-000000000000', 'Bob', 'B', 'active'),
  ('52000000-0000-0000-0000-000000000003', '5a000000-0000-0000-0000-000000000000', 'Cyd', 'C', 'active');
insert into public.disciplines (id, gym_id, name, color) values
  ('53000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000000', 'Renfo', '#2563eb');
insert into public.class_templates (id, gym_id, discipline_id, weekday, start_time, duration_minutes, capacity, starts_on) values
  ('54000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000000', '53000000-0000-0000-0000-000000000001',
   2, '18:30', 60, 10, '2026-01-01');
insert into public.class_sessions (id, gym_id, template_id, discipline_id, starts_at, ends_at, capacity) values
  -- s1 : en cours, deux inscrits confirmés et un présent. s2, s3 : à venir, issues du cours.
  ('55000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000000', null, '53000000-0000-0000-0000-000000000001',
   now() - interval '10 minutes', now() + interval '50 minutes', 10),
  ('55000000-0000-0000-0000-000000000002', '5a000000-0000-0000-0000-000000000000', '54000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001',
   now() + interval '2 days', now() + interval '2 days 1 hour', 10),
  ('55000000-0000-0000-0000-000000000003', '5a000000-0000-0000-0000-000000000000', '54000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001',
   now() + interval '9 days', now() + interval '9 days 1 hour', 10);
insert into public.bookings (gym_id, session_id, member_id, status) values
  ('5a000000-0000-0000-0000-000000000000', '55000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', 'confirmed'),
  ('5a000000-0000-0000-0000-000000000000', '55000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', 'confirmed'),
  ('5a000000-0000-0000-0000-000000000000', '55000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000003', 'attended'),
  ('5a000000-0000-0000-0000-000000000000', '55000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000001', 'confirmed');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('51000000-0000-0000-0000-000000000003');
select throws_ok($$select public.set_attendance_many('55000000-0000-0000-0000-000000000001')$$,
  'P0001', 'forbidden', 'adhérent : pas de pointage');
select pg_temp.login_as('51000000-0000-0000-0000-000000000004');
select throws_ok($$select public.set_attendance_many('55000000-0000-0000-0000-000000000001')$$,
  'P0001', 'forbidden', 'gérant d''une autre salle : pas de pointage');

select pg_temp.login_as('51000000-0000-0000-0000-000000000002');
select is(cardinality(public.set_attendance_many('55000000-0000-0000-0000-000000000001')), 2,
  'accueil : les deux inscrits confirmés pointés');
select is((select count(*)::integer from public.bookings
           where session_id = '55000000-0000-0000-0000-000000000001' and status = 'attended'), 3,
  'tous présents, le présent déjà pointé compris');
select is(cardinality(public.set_attendance_many('55000000-0000-0000-0000-000000000001')), 0,
  'deuxième appel : plus personne à pointer');

select throws_ok($$select * from public.template_change_preview('54000000-0000-0000-0000-000000000001')$$,
  'P0001', 'forbidden', 'aperçu de cours : réservé au gérant');
select pg_temp.login_as('51000000-0000-0000-0000-000000000004');
select throws_ok($$select * from public.template_change_preview('54000000-0000-0000-0000-000000000001')$$,
  'P0001', 'forbidden', 'aperçu : pas pour un gérant d''une autre salle');

select pg_temp.login_as('51000000-0000-0000-0000-000000000001');
select is((select sessions from public.template_change_preview('54000000-0000-0000-0000-000000000001')), 2,
  'aperçu : deux séances à venir');
select is((select (kept, booked)::text from public.template_change_preview('54000000-0000-0000-0000-000000000001')), '(1,1)',
  'aperçu : une séance réservée gardée, un inscrit');

select * from finish();
rollback;
