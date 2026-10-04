-- Indicateurs (gym_kpis) et gestion de l'équipe (add/remove_team_role, team_members).
begin;
select plan(16);

insert into auth.users (id, email) values
  ('a0000001-0000-0000-0000-000000000001', 't-gerant@test.local'),
  ('a0000001-0000-0000-0000-000000000002', 't-futur-coach@test.local'),
  ('a0000001-0000-0000-0000-000000000003', 't-membre@test.local'),
  ('a0000001-0000-0000-0000-000000000004', 't-admin@test.local'),
  ('a0000001-0000-0000-0000-000000000005', 't-accueil@test.local');
update public.profiles set first_name = 'Lina', last_name = 'Coach' where id = 'a0000001-0000-0000-0000-000000000002';

insert into public.gyms (id, name, slug, timezone) values
  ('aa000001-0000-0000-0000-000000000000', 'Salle T', 'salle-t-kpi', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('aa000001-0000-0000-0000-000000000000', 'a0000001-0000-0000-0000-000000000001', 'manager'),
  ('aa000001-0000-0000-0000-000000000000', 'a0000001-0000-0000-0000-000000000003', 'member'),
  ('aa000001-0000-0000-0000-000000000000', 'a0000001-0000-0000-0000-000000000004', 'admin'),
  ('aa000001-0000-0000-0000-000000000000', 'a0000001-0000-0000-0000-000000000005', 'staff');

insert into public.members (id, gym_id, profile_id, first_name, last_name, status, created_at) values
  ('a1000001-0000-0000-0000-000000000001', 'aa000001-0000-0000-0000-000000000000', 'a0000001-0000-0000-0000-000000000003', 'Ralenti', 'T', 'active', now() - interval '100 days'),
  ('a1000001-0000-0000-0000-000000000002', 'aa000001-0000-0000-0000-000000000000', null, 'Nouveau', 'T', 'prospect', now() - interval '2 days');
insert into public.disciplines (id, gym_id, name, color) values
  ('a4000001-0000-0000-0000-000000000001', 'aa000001-0000-0000-0000-000000000000', 'CrossFit', '#dc2626');
-- Quatre séances il y a 35 à 50 jours (le membre y était), une il y a 3 jours (absent).
insert into public.class_sessions (id, gym_id, discipline_id, starts_at, ends_at, capacity)
select ('a6000001-0000-0000-0000-00000000000' || n)::uuid, 'aa000001-0000-0000-0000-000000000000',
  'a4000001-0000-0000-0000-000000000001',
  now() - make_interval(days => d), now() - make_interval(days => d) + interval '1 hour', 10
from (values (1, 35), (2, 40), (3, 45), (4, 50), (5, 3)) v(n, d);
insert into public.bookings (gym_id, session_id, member_id, status)
select 'aa000001-0000-0000-0000-000000000000', ('a6000001-0000-0000-0000-00000000000' || n)::uuid,
  'a1000001-0000-0000-0000-000000000001', case when n = 5 then 'no_show' else 'attended' end::public.booking_status
from generate_series(1, 5) n;

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.kpis() returns jsonb language sql as $$
  select public.gym_kpis('aa000001-0000-0000-0000-000000000000',
    ((now() at time zone 'Europe/Paris')::date - 60), (now() at time zone 'Europe/Paris')::date);
$$;

select pg_temp.login_as('a0000001-0000-0000-0000-000000000001');
select is((pg_temp.kpis() ->> 'sessions')::integer, 5, 'indicateurs : séances passées de la période');
select is((pg_temp.kpis() ->> 'attended')::integer, 4, 'indicateurs : présences');
select is((pg_temp.kpis() ->> 'no_show')::integer, 1, 'indicateurs : absences');
select is((pg_temp.kpis() ->> 'new_members')::integer, 1, 'indicateurs : nouvelles fiches');
select is(pg_temp.kpis() -> 'at_risk' -> 0 ->> 'name', 'Ralenti T', 'indicateurs : adhérent en baisse de fréquence');
select is(jsonb_array_length(pg_temp.kpis() -> 'by_discipline'), 1, 'indicateurs : remplissage par discipline');
select throws_ok($$select public.gym_kpis('aa000001-0000-0000-0000-000000000000', '2026-02-01', '2026-01-01')$$,
  'P0001', 'invalid_period', 'indicateurs : période invalide');

-- Équipe
select throws_ok($$select public.add_team_role('aa000001-0000-0000-0000-000000000000', 'inconnu@test.local', 'staff')$$,
  'P0001', 'account_not_found', 'équipe : compte inconnu');
select lives_ok($$select public.add_team_role('aa000001-0000-0000-0000-000000000000', 'T-Futur-Coach@test.local', 'coach')$$,
  'équipe : le gérant ajoute un coach par email');
select is((select display_name from public.coaches where profile_id = 'a0000001-0000-0000-0000-000000000002'),
  'Lina C.', 'équipe : fiche coach créée');
select throws_ok($$select public.add_team_role('aa000001-0000-0000-0000-000000000000', 't-membre@test.local', 'admin')$$,
  'P0001', 'forbidden', 'équipe : seul un admin attribue admin');
select throws_ok($$select public.remove_team_role('aa000001-0000-0000-0000-000000000000', 'a0000001-0000-0000-0000-000000000001', 'manager')$$,
  'P0001', 'cannot_remove_self', 'équipe : pas de retrait de son propre rôle');
select is((select count(*) from public.team_members('aa000001-0000-0000-0000-000000000000')), 4::bigint,
  'équipe : liste sans les adhérents');

select pg_temp.login_as('a0000001-0000-0000-0000-000000000004');
select lives_ok($$select public.remove_team_role('aa000001-0000-0000-0000-000000000000', 'a0000001-0000-0000-0000-000000000005', 'staff')$$,
  'équipe : l''admin retire un rôle');

select pg_temp.login_as('a0000001-0000-0000-0000-000000000005');
select throws_ok($$select public.gym_kpis('aa000001-0000-0000-0000-000000000000', '2026-01-01', '2026-01-31')$$,
  'P0001', 'forbidden', 'ancien accueil : pas d''indicateurs');
select pg_temp.login_as('a0000001-0000-0000-0000-000000000003');
select throws_ok($$select * from public.team_members('aa000001-0000-0000-0000-000000000000')$$,
  'P0001', 'forbidden', 'adhérent : pas de liste d''équipe');
select pg_temp.logout();

select * from finish();
rollback;
