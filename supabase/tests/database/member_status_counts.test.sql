-- Comptes par statut des onglets d'Adhérents : une lecture, tous les statuts (zéro compris),
-- pour l'accueil et le gérant ; refus pour un adhérent et pour l'équipe d'une autre salle.
begin;
select plan(7);

insert into auth.users (id, email) values
  ('d0000001-0000-0000-0000-000000000001', 'c-gerant@test.local'),
  ('d0000001-0000-0000-0000-000000000002', 'c-accueil@test.local'),
  ('d0000001-0000-0000-0000-000000000003', 'c-membre@test.local'),
  ('d0000001-0000-0000-0000-000000000004', 'c-gerant-b@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('da000001-0000-0000-0000-000000000000', 'Salle C', 'salle-c-comptes', 'Europe/Paris'),
  ('da000002-0000-0000-0000-000000000000', 'Salle D', 'salle-d-comptes', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000001', 'manager'),
  ('da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000002', 'staff'),
  ('da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000003', 'member'),
  ('da000002-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000004', 'manager');
insert into public.members (id, gym_id, first_name, last_name, status) values
  ('d1000001-0000-0000-0000-000000000001', 'da000001-0000-0000-0000-000000000000', 'Pia', 'Un', 'prospect'),
  ('d1000001-0000-0000-0000-000000000002', 'da000001-0000-0000-0000-000000000000', 'Paul', 'Deux', 'prospect'),
  ('d1000001-0000-0000-0000-000000000003', 'da000001-0000-0000-0000-000000000000', 'Ali', 'Trois', 'active'),
  ('d1000001-0000-0000-0000-000000000004', 'da000001-0000-0000-0000-000000000000', 'Rose', 'Quatre', 'cancelled'),
  ('d1000001-0000-0000-0000-000000000005', 'da000002-0000-0000-0000-000000000000', 'Zoé', 'Ailleurs', 'active');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('d0000001-0000-0000-0000-000000000002');
select is((select count(*) from public.member_status_counts('da000001-0000-0000-0000-000000000000')), 4::bigint,
  'accueil : une ligne par statut, même à zéro');
select is((select total from public.member_status_counts('da000001-0000-0000-0000-000000000000') where status = 'prospect'), 2,
  'accueil : deux prospects');
select is((select total from public.member_status_counts('da000001-0000-0000-0000-000000000000') where status = 'suspended'), 0,
  'accueil : zéro suspendu');
select is((select total from public.member_status_counts('da000001-0000-0000-0000-000000000000') where status = 'active'), 1,
  'accueil : l''adhérente de l''autre salle n''est pas comptée');

select pg_temp.login_as('d0000001-0000-0000-0000-000000000001');
select is((select total from public.member_status_counts('da000001-0000-0000-0000-000000000000') where status = 'cancelled'), 1,
  'gérant : une résiliée');

select pg_temp.login_as('d0000001-0000-0000-0000-000000000003');
select throws_ok($$select * from public.member_status_counts('da000001-0000-0000-0000-000000000000')$$,
  'P0001', 'forbidden', 'adhérent : refusé');

select pg_temp.login_as('d0000001-0000-0000-0000-000000000004');
select throws_ok($$select * from public.member_status_counts('da000001-0000-0000-0000-000000000000')$$,
  'P0001', 'forbidden', 'gérant d''une autre salle : refusé');

select * from finish();
rollback;
