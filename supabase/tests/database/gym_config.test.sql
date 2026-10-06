-- Configuration de la salle : réglages internes (équipe seulement), fusion atomique par le gérant,
-- identité modifiable mais fuseau figé, jours de fermeture, seuils lus par les fonctions.
begin;
select plan(22);

insert into auth.users (id, email) values
  ('e0000003-0000-0000-0000-000000000001', 'c-gerant@test.local'),
  ('e0000003-0000-0000-0000-000000000002', 'c-accueil@test.local'),
  ('e0000003-0000-0000-0000-000000000003', 'c-membre@test.local'),
  ('e0000003-0000-0000-0000-000000000004', 'c-autre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('ea000003-0000-0000-0000-000000000001', 'Salle C', 'salle-c-config', 'Europe/Paris'),
  ('ea000003-0000-0000-0000-000000000002', 'Salle D', 'salle-d-config', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('ea000003-0000-0000-0000-000000000001', 'e0000003-0000-0000-0000-000000000001', 'manager'),
  ('ea000003-0000-0000-0000-000000000001', 'e0000003-0000-0000-0000-000000000002', 'staff'),
  ('ea000003-0000-0000-0000-000000000001', 'e0000003-0000-0000-0000-000000000003', 'member'),
  ('ea000003-0000-0000-0000-000000000002', 'e0000003-0000-0000-0000-000000000004', 'manager');
insert into public.members (id, gym_id, first_name, last_name, status) values
  ('e1000003-0000-0000-0000-000000000001', 'ea000003-0000-0000-0000-000000000001', 'Ali', 'Actif', 'active');
insert into public.gym_closures (gym_id, day, label) values
  ('ea000003-0000-0000-0000-000000000002', '2026-12-25', 'Noël (autre salle)');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Gérant : fusion des réglages publics et internes, null = retour au défaut.
select pg_temp.login_as('e0000003-0000-0000-0000-000000000001');
select lives_ok($$select public.update_gym_settings('ea000003-0000-0000-0000-000000000001',
  '{"max_upcoming_bookings": 8}', '{"trial_followup_days": 10, "credit_adjust_max": 5}')$$,
  'gérant : enregistre les réglages');
select lives_ok($$select public.update_gym_settings('ea000003-0000-0000-0000-000000000001',
  '{}', '{"trial_followup_days": null, "low_fill_percent": 40}')$$, 'gérant : seconde fusion');
select is((select settings from public.gym_private_settings where gym_id = 'ea000003-0000-0000-0000-000000000001'),
  '{"credit_adjust_max": 5, "low_fill_percent": 40}'::jsonb, 'fusion conservée, clé à null retirée');
select is((select settings ->> 'max_upcoming_bookings' from public.gyms where id = 'ea000003-0000-0000-0000-000000000001'),
  '8', 'réglage public fusionné');
select throws_ok($$select public.update_gym_settings('ea000003-0000-0000-0000-000000000001', '[]')$$,
  'P0001', 'invalid_settings', 'réglages : objet attendu');
select throws_ok($$select public.update_gym_settings('ea000003-0000-0000-0000-000000000002', '{}', '{"crm_list_limit": 10}')$$,
  'P0001', 'forbidden', 'gérant : pas les réglages d''une autre salle');

-- Seuil lu par adjust_credits (plafond réglé à 5).
select throws_ok($$select public.adjust_credits('e1000003-0000-0000-0000-000000000001', 6)$$,
  'P0001', 'invalid_amount', 'plafond de crédits réglé appliqué');
select lives_ok($$select public.adjust_credits('e1000003-0000-0000-0000-000000000001', 5)$$,
  'ajout sous le plafond accepté');

-- Identité modifiable, fuseau figé.
select lives_ok($$update public.gyms set phone = '01 23 45 67 89', opening_hours = '{"1": [{"start": "07:00", "end": "21:00"}]}'
  where id = 'ea000003-0000-0000-0000-000000000001'$$, 'gérant : identité et horaires');
select throws_ok($$update public.gyms set timezone = 'America/New_York' where id = 'ea000003-0000-0000-0000-000000000001'$$,
  '42501', null, 'fuseau non modifiable');
select throws_ok($$update public.gyms set settings = '{}' where id = 'ea000003-0000-0000-0000-000000000001'$$,
  '42501', null, 'réglages : uniquement par update_gym_settings');

-- Fermetures : le gérant ajoute, l'équipe lit, une autre salle reste invisible.
select lives_ok($$insert into public.gym_closures (gym_id, day, label)
  values ('ea000003-0000-0000-0000-000000000001', '2026-12-24', 'Réveillon')$$, 'gérant : ajoute une fermeture');
select is((select count(*)::integer from public.gym_closures), 1, 'gérant : ne voit pas les fermetures d''une autre salle');

-- Accueil : lit, ne modifie pas.
select pg_temp.login_as('e0000003-0000-0000-0000-000000000002');
select is((select count(*)::integer from public.gym_private_settings), 1, 'accueil : lit les réglages internes de sa salle');
select throws_ok($$select public.update_gym_settings('ea000003-0000-0000-0000-000000000001', '{}', '{"crm_list_limit": 10}')$$,
  'P0001', 'forbidden', 'accueil : pas de modification des réglages');
select throws_ok($$insert into public.gym_closures (gym_id, day, label)
  values ('ea000003-0000-0000-0000-000000000001', '2026-12-31', 'Saint-Sylvestre')$$,
  '42501', null, 'accueil : pas d''ajout de fermeture');

-- Adhérent et visiteur : rien.
select pg_temp.login_as('e0000003-0000-0000-0000-000000000003');
select is((select count(*)::integer from public.gym_private_settings) + (select count(*)::integer from public.gym_closures),
  0, 'adhérent : ni réglages internes ni fermetures');
reset role;
set local role anon;
select throws_ok($$select * from public.gym_private_settings$$, '42501', null, 'visiteur : aucun accès');
reset role;

-- Ordre des disciplines : nouvelle en dernier, réordonnées par le gérant seulement.
insert into public.disciplines (id, gym_id, name, color) values
  ('e2000003-0000-0000-0000-000000000001', 'ea000003-0000-0000-0000-000000000001', 'Yoga', '#16a34a'),
  ('e2000003-0000-0000-0000-000000000002', 'ea000003-0000-0000-0000-000000000001', 'Boxe', '#dc2626');
select is((select array_agg(name order by position) from public.disciplines where gym_id = 'ea000003-0000-0000-0000-000000000001'),
  array['Yoga', 'Boxe'], 'nouvelle discipline en dernier');
select pg_temp.login_as('e0000003-0000-0000-0000-000000000001');
select lives_ok($$select public.reorder_disciplines('ea000003-0000-0000-0000-000000000001',
  array['e2000003-0000-0000-0000-000000000002', 'e2000003-0000-0000-0000-000000000001']::uuid[])$$, 'gérant : réordonne');
reset role;
select is((select array_agg(name order by position) from public.disciplines where gym_id = 'ea000003-0000-0000-0000-000000000001'),
  array['Boxe', 'Yoga'], 'ordre enregistré');

select is(private.storage_gym_id('ea000003-0000-0000-0000-000000000001/logo-1.png'),
  'ea000003-0000-0000-0000-000000000001'::uuid, 'dossier du logo : identifiant de la salle');

select * from finish();
rollback;
