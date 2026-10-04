-- Cours souples : plusieurs coachs, places et durée par séance ou « et les suivantes »,
-- séance ponctuelle, cours récurrent modifié, RLS des tables de liaison.
begin;
select plan(26);

insert into auth.users (id, email) values
  ('b0000001-0000-0000-0000-000000000001', 'x-gerant@test.local'),
  ('b0000001-0000-0000-0000-000000000002', 'x-coach-a@test.local'),
  ('b0000001-0000-0000-0000-000000000003', 'x-coach-b@test.local'),
  ('b0000001-0000-0000-0000-000000000004', 'x-un@test.local'),
  ('b0000001-0000-0000-0000-000000000005', 'x-deux@test.local'),
  ('b0000001-0000-0000-0000-000000000006', 'x-trois@test.local'),
  ('b0000001-0000-0000-0000-000000000007', 'x-gerant-autre@test.local');

insert into public.gyms (id, name, slug, timezone) values
  ('ba000001-0000-0000-0000-000000000000', 'Salle X', 'salle-x', 'Europe/Paris'),
  ('bb000001-0000-0000-0000-000000000000', 'Salle Y', 'salle-y', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('ba000001-0000-0000-0000-000000000000', 'b0000001-0000-0000-0000-000000000001', 'manager'),
  ('ba000001-0000-0000-0000-000000000000', 'b0000001-0000-0000-0000-000000000002', 'coach'),
  ('ba000001-0000-0000-0000-000000000000', 'b0000001-0000-0000-0000-000000000003', 'coach'),
  ('bb000001-0000-0000-0000-000000000000', 'b0000001-0000-0000-0000-000000000007', 'manager');

insert into public.coaches (id, gym_id, profile_id, display_name) values
  ('b5000001-0000-0000-0000-00000000000a', 'ba000001-0000-0000-0000-000000000000', 'b0000001-0000-0000-0000-000000000002', 'Coach A'),
  ('b5000001-0000-0000-0000-00000000000b', 'ba000001-0000-0000-0000-000000000000', 'b0000001-0000-0000-0000-000000000003', 'Coach B');
insert into public.coach_compensations (coach_id, gym_id, employment_type, hourly_rate_cents) values
  ('b5000001-0000-0000-0000-00000000000a', 'ba000001-0000-0000-0000-000000000000', 'freelance', 3000),
  ('b5000001-0000-0000-0000-00000000000b', 'ba000001-0000-0000-0000-000000000000', 'freelance', 4000);
insert into public.disciplines (id, gym_id, name, color, default_duration_minutes, default_capacity) values
  ('b4000001-0000-0000-0000-000000000001', 'ba000001-0000-0000-0000-000000000000', 'Mobilité', '#2563eb', 45, 10);
insert into public.rooms (id, gym_id, name, capacity) values
  ('b3000001-0000-0000-0000-000000000001', 'ba000001-0000-0000-0000-000000000000', 'Petite salle', 3);

insert into public.members (id, gym_id, profile_id, first_name, last_name, status) values
  ('b1000001-0000-0000-0000-000000000001', 'ba000001-0000-0000-0000-000000000000', 'b0000001-0000-0000-0000-000000000004', 'Un', 'X', 'active'),
  ('b1000001-0000-0000-0000-000000000002', 'ba000001-0000-0000-0000-000000000000', 'b0000001-0000-0000-0000-000000000005', 'Deux', 'X', 'active'),
  ('b1000001-0000-0000-0000-000000000003', 'ba000001-0000-0000-0000-000000000000', 'b0000001-0000-0000-0000-000000000006', 'Trois', 'X', 'active');
insert into public.credit_ledger (gym_id, member_id, delta, reason)
select 'ba000001-0000-0000-0000-000000000000', id, 5, 'purchase' from public.members
where gym_id = 'ba000001-0000-0000-0000-000000000000';

-- Cours récurrent du mardi, coach A ; trois séances futures générées à la main + une passée.
insert into public.class_templates (id, gym_id, discipline_id, default_coach_id, weekday, start_time, duration_minutes, capacity, starts_on) values
  ('b7000001-0000-0000-0000-000000000001', 'ba000001-0000-0000-0000-000000000000', 'b4000001-0000-0000-0000-000000000001',
   'b5000001-0000-0000-0000-00000000000a', 2, '18:30', 60, 2, '2026-01-01');
insert into public.class_sessions (id, gym_id, template_id, discipline_id, coach_id, starts_at, ends_at, capacity) values
  ('b6000001-0000-0000-0000-000000000001', 'ba000001-0000-0000-0000-000000000000', 'b7000001-0000-0000-0000-000000000001', 'b4000001-0000-0000-0000-000000000001', 'b5000001-0000-0000-0000-00000000000a', '2030-03-05 17:30+00', '2030-03-05 18:30+00', 2),
  ('b6000001-0000-0000-0000-000000000002', 'ba000001-0000-0000-0000-000000000000', 'b7000001-0000-0000-0000-000000000001', 'b4000001-0000-0000-0000-000000000001', 'b5000001-0000-0000-0000-00000000000a', '2030-03-12 17:30+00', '2030-03-12 18:30+00', 2),
  ('b6000001-0000-0000-0000-000000000003', 'ba000001-0000-0000-0000-000000000000', 'b7000001-0000-0000-0000-000000000001', 'b4000001-0000-0000-0000-000000000001', 'b5000001-0000-0000-0000-00000000000a', '2030-03-19 17:30+00', '2030-03-19 18:30+00', 2),
  ('b6000001-0000-0000-0000-000000000009', 'ba000001-0000-0000-0000-000000000000', null, 'b4000001-0000-0000-0000-000000000001', 'b5000001-0000-0000-0000-00000000000a', now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 5);

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select is((select count(*) from public.session_coaches where session_id = 'b6000001-0000-0000-0000-000000000001'),
  1::bigint, 'coach principal repris dans session_coaches');

-- Un et Deux remplissent s1 (2 places), Trois en liste d'attente.
select pg_temp.login_as('b0000001-0000-0000-0000-000000000004');
select public.book_session('b6000001-0000-0000-0000-000000000001');
select pg_temp.login_as('b0000001-0000-0000-0000-000000000005');
select public.book_session('b6000001-0000-0000-0000-000000000001');
select pg_temp.login_as('b0000001-0000-0000-0000-000000000006');
select is((public.book_session('b6000001-0000-0000-0000-000000000001')).status, 'waitlisted', 'séance pleine : liste d''attente');

-- Droits
select throws_ok($$select public.update_session('b6000001-0000-0000-0000-000000000001', '{"capacity": 3}')$$,
  'P0001', 'forbidden', 'un adhérent ne modifie pas une séance');
select pg_temp.login_as('b0000001-0000-0000-0000-000000000007');
select throws_ok($$select public.update_session('b6000001-0000-0000-0000-000000000001', '{"capacity": 3}')$$,
  'P0001', 'forbidden', 'un gérant d''une autre salle non plus');

select pg_temp.login_as('b0000001-0000-0000-0000-000000000001');
-- Places
select throws_ok($$select public.update_session('b6000001-0000-0000-0000-000000000001', '{"capacity": 1}')$$,
  'P0001', 'capacity_below_booked', 'places : refus sous le nombre d''inscrits');
select is(public.update_session('b6000001-0000-0000-0000-000000000001', '{"capacity": 3}'), 1, 'places : séance seule');
select is((select status from public.bookings where member_id = 'b1000001-0000-0000-0000-000000000003'),
  'confirmed'::public.booking_status, 'places : la liste d''attente est promue');
select ok((select is_customized from public.class_sessions where id = 'b6000001-0000-0000-0000-000000000001'),
  'séance modifiée seule : personnalisée');
select throws_ok($$select public.update_session('b6000001-0000-0000-0000-000000000002', '{"room_id": "b3000001-0000-0000-0000-000000000001", "capacity": 4}')$$,
  'P0001', 'room_capacity_exceeded', 'salle : capacité respectée');
select throws_ok($$select public.update_session('b6000001-0000-0000-0000-000000000002', '{"duration_minutes": 47}')$$,
  'P0001', 'invalid_duration', 'durée : par pas de 5 minutes');

-- Deux coachs et 75 min pour s2 « et les suivantes » : s1 (personnalisée, antérieure) épargnée.
select is(public.update_session('b6000001-0000-0000-0000-000000000002',
  '{"duration_minutes": 75, "coach_ids": ["b5000001-0000-0000-0000-00000000000a", "b5000001-0000-0000-0000-00000000000b"]}', 'following'),
  2, 'et les suivantes : deux séances modifiées');
select is((select ends_at - starts_at from public.class_sessions where id = 'b6000001-0000-0000-0000-000000000003'),
  interval '75 minutes', 'et les suivantes : durée appliquée');
select is((select count(*) from public.session_coaches where session_id = 'b6000001-0000-0000-0000-000000000003'),
  2::bigint, 'et les suivantes : deux coachs');
select is((select ends_at - starts_at from public.class_sessions where id = 'b6000001-0000-0000-0000-000000000001'),
  interval '60 minutes', 'séance personnalisée épargnée');
select is((select duration_minutes from public.class_templates where id = 'b7000001-0000-0000-0000-000000000001'),
  75, 'cours récurrent mis à jour');
select is((select count(*) from public.template_coaches where template_id = 'b7000001-0000-0000-0000-000000000001'),
  2::bigint, 'cours récurrent : deux coachs');
select is((select coach_id from public.class_sessions where id = 'b6000001-0000-0000-0000-000000000003'),
  'b5000001-0000-0000-0000-00000000000a'::uuid, 'coach principal = premier de la liste');

-- Coach B, ajouté, pointe et voit ses heures ; conflit détecté pour lui.
select pg_temp.logout();
select ok(private.coach_has_conflict('b5000001-0000-0000-0000-00000000000b', '2030-03-12 17:45+00', '2030-03-12 18:15+00'),
  'conflit : chaque coach assigné');
select pg_temp.login_as('b0000001-0000-0000-0000-000000000003');
select ok(private.is_session_coach('b6000001-0000-0000-0000-000000000002'), 'le second coach est coach de la séance');

-- Heures : séance passée à deux coachs → durée complète chacun.
select pg_temp.logout();
insert into public.session_coaches (gym_id, session_id, coach_id, position) values
  ('ba000001-0000-0000-0000-000000000000', 'b6000001-0000-0000-0000-000000000009', 'b5000001-0000-0000-0000-00000000000b', 1);
select pg_temp.login_as('b0000001-0000-0000-0000-000000000001');
select is((select sum(minutes) from public.coach_hours('ba000001-0000-0000-0000-000000000000', (now() - interval '10 days')::date, now()::date))::integer,
  120, 'heures : durée complète pour chacun des deux coachs');

-- Séance ponctuelle : valeurs par défaut de la discipline.
select is((select ends_at - starts_at from public.create_session('ba000001-0000-0000-0000-000000000000',
  'b4000001-0000-0000-0000-000000000001', '2030-04-01 08:00+00', null, null,
  array['b5000001-0000-0000-0000-00000000000b']::uuid[])), interval '45 minutes', 'séance ponctuelle : durée par défaut');

-- Cours récurrent : heure changée → séances futures sans réservation régénérées.
select is((public.update_template('b7000001-0000-0000-0000-000000000001', '{"start_time": "19:00"}') ->> 'kept')::integer,
  0, 'cours récurrent : aucune séance réservée à garder');
select is((select count(*) from public.class_sessions where id = 'b6000001-0000-0000-0000-000000000003'),
  0::bigint, 'séance future non réservée supprimée pour être régénérée');
select is((select count(*) from public.class_sessions where id = 'b6000001-0000-0000-0000-000000000001'),
  1::bigint, 'séance réservée conservée');

-- RLS des tables de liaison
select pg_temp.login_as('b0000001-0000-0000-0000-000000000004');
select throws_ok($$insert into public.session_coaches (gym_id, session_id, coach_id) values
  ('ba000001-0000-0000-0000-000000000000', 'b6000001-0000-0000-0000-000000000002', 'b5000001-0000-0000-0000-00000000000b')$$,
  '42501', null, 'adhérent : pas d''écriture directe');
select pg_temp.login_as('b0000001-0000-0000-0000-000000000007');
select is((select count(*) from public.template_coaches where template_id = 'b7000001-0000-0000-0000-000000000001'),
  0::bigint, 'autre salle : coachs des cours récurrents invisibles');
select pg_temp.logout();

select * from finish();
rollback;
