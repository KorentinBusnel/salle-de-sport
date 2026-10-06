-- Pastilles de la barre latérale : comptages par rôle, refus hors de l'équipe.
begin;
select plan(5);

insert into auth.users (id, email) values
  ('e0000001-0000-0000-0000-000000000001', 'n-gerant@test.local'),
  ('e0000001-0000-0000-0000-000000000002', 'n-accueil@test.local'),
  ('e0000001-0000-0000-0000-000000000003', 'n-membre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('ea000001-0000-0000-0000-000000000000', 'Salle N', 'salle-n-nav', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('ea000001-0000-0000-0000-000000000000', 'e0000001-0000-0000-0000-000000000001', 'manager'),
  ('ea000001-0000-0000-0000-000000000000', 'e0000001-0000-0000-0000-000000000002', 'staff'),
  ('ea000001-0000-0000-0000-000000000000', 'e0000001-0000-0000-0000-000000000003', 'member');
insert into public.members (id, gym_id, first_name, last_name, status) values
  ('e1000001-0000-0000-0000-000000000001', 'ea000001-0000-0000-0000-000000000000', 'Pia', 'Prospect', 'prospect'),
  ('e1000001-0000-0000-0000-000000000002', 'ea000001-0000-0000-0000-000000000000', 'Ali', 'Actif', 'active');
insert into public.interactions (gym_id, member_id, channel, direction, summary) values
  ('ea000001-0000-0000-0000-000000000000', 'e1000001-0000-0000-0000-000000000002', 'email', 'inbound', 'Question');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('e0000001-0000-0000-0000-000000000001');
select is((select prospects from public.nav_counts('ea000001-0000-0000-0000-000000000000')), 1, 'gérant : prospects');
select is((select unanswered from public.nav_counts('ea000001-0000-0000-0000-000000000000')), 1, 'gérant : message sans réponse');
select pg_temp.login_as('e0000001-0000-0000-0000-000000000002');
select is((select prospects from public.nav_counts('ea000001-0000-0000-0000-000000000000')), 1, 'accueil : prospects');
select is((select unanswered from public.nav_counts('ea000001-0000-0000-0000-000000000000')), null, 'accueil : pas de CRM');
select pg_temp.login_as('e0000001-0000-0000-0000-000000000003');
select throws_ok($$select * from public.nav_counts('ea000001-0000-0000-0000-000000000000')$$,
  'P0001', 'forbidden', 'adhérent : refusé');

select * from finish();
rollback;
