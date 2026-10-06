-- Synthèse de fiche : accueil et gérant de la salle seulement ; finances au gérant ; fidélité,
-- offre et derniers emails calculés en base.
begin;
select plan(12);

insert into auth.users (id, email) values
  ('91000000-0000-0000-0000-000000000001', 'mo-gerant@test.local'),
  ('91000000-0000-0000-0000-000000000002', 'mo-accueil@test.local'),
  ('91000000-0000-0000-0000-000000000003', 'mo-membre@test.local'),
  ('91000000-0000-0000-0000-000000000004', 'mo-autre@test.local'),
  ('91000000-0000-0000-0000-000000000005', 'mo-coach@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('9a000000-0000-0000-0000-000000000000', 'Salle MO', 'salle-mo', 'Europe/Paris'),
  ('9b000000-0000-0000-0000-000000000000', 'Salle MP', 'salle-mp', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('9a000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000001', 'manager'),
  ('9a000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000002', 'staff'),
  ('9a000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000003', 'member'),
  ('9b000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000004', 'manager'),
  ('9a000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000005', 'coach');
insert into public.members (id, gym_id, profile_id, first_name, last_name, email, status) values
  ('92000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000000', '91000000-0000-0000-0000-000000000003', 'Mo', 'Abel', 'mo@test.local', 'active');
insert into public.disciplines (id, gym_id, name, color) values
  ('93000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000000', 'Run', '#16a34a');
insert into public.class_sessions (id, gym_id, discipline_id, starts_at, ends_at, capacity) values
  ('94000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000000', '93000000-0000-0000-0000-000000000001', now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 10),
  ('94000000-0000-0000-0000-000000000002', '9a000000-0000-0000-0000-000000000000', '93000000-0000-0000-0000-000000000001', now() - interval '10 days', now() - interval '10 days' + interval '1 hour', 10),
  ('94000000-0000-0000-0000-000000000003', '9a000000-0000-0000-0000-000000000000', '93000000-0000-0000-0000-000000000001', now() - interval '45 days', now() - interval '45 days' + interval '1 hour', 10),
  ('94000000-0000-0000-0000-000000000004', '9a000000-0000-0000-0000-000000000000', '93000000-0000-0000-0000-000000000001', now() - interval '5 days', now() - interval '5 days' + interval '1 hour', 10);
insert into public.bookings (gym_id, session_id, member_id, status) values
  ('9a000000-0000-0000-0000-000000000000', '94000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'attended'),
  ('9a000000-0000-0000-0000-000000000000', '94000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', 'attended'),
  ('9a000000-0000-0000-0000-000000000000', '94000000-0000-0000-0000-000000000003', '92000000-0000-0000-0000-000000000001', 'attended'),
  ('9a000000-0000-0000-0000-000000000000', '94000000-0000-0000-0000-000000000004', '92000000-0000-0000-0000-000000000001', 'no_show');
insert into public.plans (id, gym_id, name, type, price_cents, billing_interval) values
  ('95000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000000', 'Illimité', 'recurring', 7900, 'month');
insert into public.subscriptions (gym_id, member_id, plan_id, status, current_period_end) values
  ('9a000000-0000-0000-0000-000000000000', '92000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', 'active', now() + interval '20 days');
insert into public.payments (gym_id, member_id, plan_id, amount_cents, status, method, paid_at) values
  ('9a000000-0000-0000-0000-000000000000', '92000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', 7900, 'succeeded', 'card', now() - interval '10 days'),
  ('9a000000-0000-0000-0000-000000000000', '92000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', 7900, 'succeeded', 'card', now() - interval '40 days');
insert into public.outbound_messages (gym_id, member_id, channel, origin, subject, body, to_address, created_at)
select '9a000000-0000-0000-0000-000000000000', '92000000-0000-0000-0000-000000000001', 'email', 'campaign',
       'Message ' || i, 'Bonjour', 'mo@test.local', now() - make_interval(days => i)
from generate_series(1, 7) i;

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Gérant : tout, finances comprises
select pg_temp.login_as('91000000-0000-0000-0000-000000000001');
select is((public.member_overview('92000000-0000-0000-0000-000000000001') #>> '{loyalty,attended}')::integer, 3, 'séances suivies au total');
select is((public.member_overview('92000000-0000-0000-0000-000000000001') #>> '{loyalty,attended_30d}')::integer, 2, 'séances des 30 derniers jours');
select is((public.member_overview('92000000-0000-0000-0000-000000000001') #>> '{loyalty,attended_prev_30d}')::integer, 1, 'séances des 30 jours précédents');
select is((public.member_overview('92000000-0000-0000-0000-000000000001') #>> '{loyalty,no_shows}')::integer, 1, 'absences');
select is(public.member_overview('92000000-0000-0000-0000-000000000001') #>> '{offer,subscription,plan}', 'Illimité', 'offre en cours');
select is((public.member_overview('92000000-0000-0000-0000-000000000001') #>> '{finance,total_paid_cents}')::integer, 15800, 'total payé (gérant)');
select is(jsonb_array_length(public.member_overview('92000000-0000-0000-0000-000000000001') #> '{emails,last}'), 5, 'cinq derniers emails');
select is(public.member_overview('92000000-0000-0000-0000-000000000001') #>> '{emails,last,0,subject}', 'Message 1', 'le plus récent d''abord');

-- Accueil : synthèse sans les finances
select pg_temp.login_as('91000000-0000-0000-0000-000000000002');
select ok(public.member_overview('92000000-0000-0000-0000-000000000001') -> 'finance' = 'null'::jsonb, 'accueil : pas de finances');

-- Coach, adhérent lui-même, autre salle : refusés
select pg_temp.login_as('91000000-0000-0000-0000-000000000005');
select throws_ok($$select public.member_overview('92000000-0000-0000-0000-000000000001')$$, 'P0001', 'forbidden', 'un coach ne voit pas la synthèse');
select pg_temp.login_as('91000000-0000-0000-0000-000000000003');
select throws_ok($$select public.member_overview('92000000-0000-0000-0000-000000000001')$$, 'P0001', 'forbidden', 'un adhérent ne voit pas la synthèse');
select pg_temp.login_as('91000000-0000-0000-0000-000000000004');
select throws_ok($$select public.member_overview('92000000-0000-0000-0000-000000000001')$$, 'P0001', 'forbidden', 'une autre salle ne voit pas la synthèse');
reset role;

select * from finish();
rollback;
