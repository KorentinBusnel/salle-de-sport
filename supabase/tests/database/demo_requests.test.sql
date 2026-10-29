-- Demandes du site vitrine : dépôt anonyme sans lecture, champs exigés selon le type (essai ou
-- question), doublon du jour par type, plafond horaire, lecture et suivi réservés aux admins.
begin;
select plan(22);

insert into auth.users (id, email) values
  ('b2100000-0000-0000-0000-000000000001', 'demo-admin@test.local'),
  ('b2100000-0000-0000-0000-000000000002', 'demo-gerant@test.local'),
  ('b2100000-0000-0000-0000-000000000003', 'demo-membre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('b2a00000-0000-0000-0000-000000000000', 'Salle Démo', 'salle-demo-test', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('b2a00000-0000-0000-0000-000000000000', 'b2100000-0000-0000-0000-000000000001', 'admin'),
  ('b2a00000-0000-0000-0000-000000000000', 'b2100000-0000-0000-0000-000000000002', 'manager'),
  ('b2a00000-0000-0000-0000-000000000000', 'b2100000-0000-0000-0000-000000000003', 'member');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Visiteur anonyme
set local role anon;
select lives_ok(
  $$select public.request_demo('trial', 'Inès Moreau', 'Box Garonne', ' Ines@Box-Garonne.test.local ',
    '06 12 34 56 78', 'Toulouse', '100_to_300', 'Bsport', 'Deux sites, 240 adhérents.')$$,
  'anonyme : demande un essai');
select lives_ok(
  $$select public.request_demo('trial', 'Inès Moreau', 'Box Garonne', 'ines@box-garonne.test.local', null,
    'Toulouse', '100_to_300', null, null)$$,
  'anonyme : même essai le même jour, sans erreur');
select lives_ok(
  $$select public.request_demo('contact', 'Inès Moreau', 'Box Garonne', 'ines@box-garonne.test.local', null,
    null, null, null, 'Le prélèvement SEPA est inclus ?')$$,
  'anonyme : question sans ville ni taille');
select throws_ok($$select count(*) from public.demo_requests$$, '42501', null, 'anonyme : ne lit pas les demandes');
select throws_ok(
  $$insert into public.demo_requests (kind, full_name, gym_name, email, city, members_band)
    values ('trial', 'Pirate', 'Pirate', 'pirate@test.local', 'Nulle part', 'under_100')$$,
  '42501', null, 'anonyme : pas d''écriture directe');
select throws_ok(
  $$select public.request_demo('trial', 'Inès Moreau', 'Box Garonne', 'pas-un-email', null, 'Toulouse', 'under_100', null, null)$$,
  'P0001', 'invalid_input', 'email invalide refusé');
select throws_ok(
  $$select public.request_demo('trial', ' I ', 'Box Garonne', 'i@test.local', null, 'Toulouse', 'under_100', null, null)$$,
  'P0001', 'invalid_input', 'nom trop court refusé');
select throws_ok(
  $$select public.request_demo('trial', 'Inès Moreau', 'Box Garonne', 'i@test.local', null, null, 'under_100', null, null)$$,
  'P0001', 'invalid_input', 'essai sans ville refusé');
select throws_ok(
  $$select public.request_demo('trial', 'Inès Moreau', 'Box Garonne', 'i@test.local', null, 'Toulouse', null, null, null)$$,
  'P0001', 'invalid_input', 'essai sans taille refusé');
select throws_ok(
  $$select public.request_demo('contact', 'Inès Moreau', 'Box Garonne', 'i@test.local', null, null, null, null, '  ')$$,
  'P0001', 'invalid_input', 'question sans message refusée');
select throws_ok(
  $$select public.request_demo('demo', 'Inès Moreau', 'Box Garonne', 'i@test.local', null, 'Toulouse', 'under_100', null, null)$$,
  'P0001', 'invalid_input', 'ancien type « demo » refusé');
select throws_ok(
  $$select public.set_demo_request(gen_random_uuid(), 'contacted', null)$$,
  '42501', null, 'anonyme : pas de suivi');
reset role;

select is(
  (select count(*)::integer from public.demo_requests where email = 'ines@box-garonne.test.local'),
  2, 'doublon du jour ignoré par type, email normalisé');

-- Lecture et suivi
select pg_temp.login_as('b2100000-0000-0000-0000-000000000002');
select is((select count(*)::integer from public.demo_requests), 0, 'gérant : ne voit pas les demandes');
select throws_ok(
  $$select public.set_demo_request((select id from public.demo_requests limit 1), 'contacted', null)$$,
  'P0001', 'forbidden', 'gérant : pas de suivi');
select pg_temp.login_as('b2100000-0000-0000-0000-000000000003');
select is((select count(*)::integer from public.demo_requests), 0, 'adhérent : ne voit pas les demandes');
select pg_temp.login_as('b2100000-0000-0000-0000-000000000001');
select is(
  (select phone from public.demo_requests where email = 'ines@box-garonne.test.local' and kind = 'trial'),
  '06 12 34 56 78', 'admin : lit la demande');
select is(
  (public.set_demo_request(
    (select id from public.demo_requests where email = 'ines@box-garonne.test.local' and kind = 'trial'),
    'contacted', '  Rappel jeudi  ')).note,
  'Rappel jeudi', 'admin : statut et note');
select is(
  (public.set_demo_request(
    (select id from public.demo_requests where email = 'ines@box-garonne.test.local' and kind = 'trial'),
    'onboarded', 'Accès ouvert')).status::text,
  'onboarded', 'admin : accès ouvert');
select is(
  (select message from public.demo_requests where email = 'ines@box-garonne.test.local' and kind = 'contact'),
  'Le prélèvement SEPA est inclus ?', 'admin : lit la question');
select throws_ok(
  $$select public.set_demo_request(gen_random_uuid(), 'dropped', null)$$,
  'P0001', 'demo_request_not_found', 'demande inconnue');
reset role;

-- Plafond horaire
insert into public.demo_requests (kind, full_name, gym_name, email, city, members_band)
select 'trial', 'Visiteur ' || n, 'Salle ' || n, 'visiteur' || n || '@test.local', 'Lyon', 'under_100'
from generate_series(1, 30) as n;
set local role anon;
select throws_ok(
  $$select public.request_demo('trial', 'Paul Girard', 'Hyrox Lab', 'paul@test.local', null, 'Nantes', 'over_600', null, null)$$,
  'P0001', 'too_many_requests', 'plafond de 30 demandes par heure');
reset role;

select * from finish();
rollback;
