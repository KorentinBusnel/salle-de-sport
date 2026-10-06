-- Liste des adhérents : solde et tri en SQL, étiquette en lot, export journalisé, consentements.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('61000000-0000-0000-0000-000000000001', 'mt-gerant@test.local'),
  ('61000000-0000-0000-0000-000000000002', 'mt-accueil@test.local'),
  ('61000000-0000-0000-0000-000000000003', 'mt-membre@test.local'),
  ('61000000-0000-0000-0000-000000000004', 'mt-autre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('6a000000-0000-0000-0000-000000000000', 'Salle MT', 'salle-mt', 'Europe/Paris'),
  ('6b000000-0000-0000-0000-000000000000', 'Salle MU', 'salle-mu', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('6a000000-0000-0000-0000-000000000000', '61000000-0000-0000-0000-000000000001', 'manager'),
  ('6a000000-0000-0000-0000-000000000000', '61000000-0000-0000-0000-000000000002', 'staff'),
  ('6a000000-0000-0000-0000-000000000000', '61000000-0000-0000-0000-000000000003', 'member'),
  ('6b000000-0000-0000-0000-000000000000', '61000000-0000-0000-0000-000000000004', 'manager');
insert into public.members (id, gym_id, profile_id, first_name, last_name, status, tags) values
  ('62000000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-000000000000', '61000000-0000-0000-0000-000000000003', 'Ana', 'Abel', 'active', '{}'),
  ('62000000-0000-0000-0000-000000000002', '6a000000-0000-0000-0000-000000000000', null, 'Bob', 'Brun', 'prospect', '{vip}'),
  ('62000000-0000-0000-0000-000000000003', '6b000000-0000-0000-0000-000000000000', null, 'Cyd', 'Coste', 'active', '{}');
insert into public.credit_ledger (gym_id, member_id, delta, reason) values
  ('6a000000-0000-0000-0000-000000000000', '62000000-0000-0000-0000-000000000001', 10, 'purchase'),
  ('6a000000-0000-0000-0000-000000000000', '62000000-0000-0000-0000-000000000001', -3, 'booking');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Solde et tri
select pg_temp.login_as('61000000-0000-0000-0000-000000000001');
select is((select credits from public.search_members('6a000000-0000-0000-0000-000000000000') where first_name = 'Ana'),
  7, 'gérant : solde calculé en SQL');
select is((select first_name from public.search_members('6a000000-0000-0000-0000-000000000000', p_sort => 'credits_desc') limit 1),
  'Ana', 'tri par crédits décroissants');
select is((select first_name from public.search_members('6a000000-0000-0000-0000-000000000000', p_sort => 'name_desc') limit 1),
  'Bob', 'tri par nom décroissant');
select pg_temp.login_as('61000000-0000-0000-0000-000000000002');
select is((select credits from public.search_members('6a000000-0000-0000-0000-000000000000') where first_name = 'Ana'),
  null, 'accueil : pas de solde (finances)');

-- Étiquette en lot
select is(public.add_member_tag('6a000000-0000-0000-0000-000000000000',
  array['62000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000003']::uuid[], ' VIP '),
  1, 'accueil : étiquette ajoutée à la seule fiche qui ne l''a pas, dans sa salle');
select is((select tags from public.members where id = '62000000-0000-0000-0000-000000000001'), array['vip'],
  'étiquette normalisée');
select throws_ok($$select public.add_member_tag('6a000000-0000-0000-0000-000000000000', array['62000000-0000-0000-0000-000000000001']::uuid[], '  ')$$,
  'P0001', 'invalid_input', 'étiquette vide refusée');

-- Export
select throws_ok($$select * from public.export_members('6a000000-0000-0000-0000-000000000000', array['62000000-0000-0000-0000-000000000001']::uuid[])$$,
  'P0001', 'forbidden', 'accueil : pas d''export');
select pg_temp.login_as('61000000-0000-0000-0000-000000000004');
select throws_ok($$select * from public.export_members('6a000000-0000-0000-0000-000000000000', array['62000000-0000-0000-0000-000000000001']::uuid[])$$,
  'P0001', 'forbidden', 'gérant d''une autre salle : pas d''export');
select pg_temp.login_as('61000000-0000-0000-0000-000000000001');
select is((select count(*)::integer from public.export_members('6a000000-0000-0000-0000-000000000000',
  array['62000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000003']::uuid[])),
  1, 'export : fiches de sa salle seulement');
select is((select (details ->> 'count')::integer from public.audit_log
           where gym_id = '6a000000-0000-0000-0000-000000000000' and action = 'members.export'),
  1, 'export journalisé');

-- Consentement
update public.members set marketing_email_consent_at = now() where id = '62000000-0000-0000-0000-000000000002';
select is((select details from public.audit_log where action = 'member.consent' and entity_id = '62000000-0000-0000-0000-000000000002'),
  '{"channel": "email", "granted": true}'::jsonb, 'consentement journalisé');

select pg_temp.login_as('61000000-0000-0000-0000-000000000003');
select throws_ok($$select public.add_member_tag('6a000000-0000-0000-0000-000000000000', array['62000000-0000-0000-0000-000000000001']::uuid[], 'x')$$,
  'P0001', 'forbidden', 'adhérent : pas d''étiquette en lot');

select * from finish();
rollback;
