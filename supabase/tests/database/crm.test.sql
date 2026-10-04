-- CRM : filtres de segments, segments enregistrés (RLS), pipeline, filtre par tag.
begin;
select plan(18);

insert into auth.users (id, email) values
  ('60000000-0000-0000-0000-000000000001', 'c-un@test.local'),
  ('60000000-0000-0000-0000-000000000002', 'c-deux@test.local'),
  ('60000000-0000-0000-0000-000000000003', 'c-gerant@test.local'),
  ('60000000-0000-0000-0000-000000000004', 'c-accueil@test.local'),
  ('60000000-0000-0000-0000-000000000005', 'c-gerant-autre@test.local');
update public.profiles set birth_date = make_date(1990, extract(month from now() at time zone 'Europe/Paris')::integer, 1)
where id = '60000000-0000-0000-0000-000000000001';

insert into public.gyms (id, name, slug, timezone) values
  ('8a000000-0000-0000-0000-000000000000', 'Salle C', 'salle-c', 'Europe/Paris'),
  ('8b000000-0000-0000-0000-000000000000', 'Salle D', 'salle-d', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('8a000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000003', 'manager'),
  ('8a000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000004', 'staff'),
  ('8b000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000005', 'manager'),
  ('8a000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000001', 'member'),
  ('8a000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000002', 'member');

-- Un : actif, assidu, consentement email, crédits 5, tag « hyrox ».
-- Deux : actif, inactif depuis 40 jours, 0 crédit. Prospect : sans réservation. Essai : tag essai.
insert into public.members (id, gym_id, profile_id, first_name, last_name, email, status, tags, marketing_email_consent_at, created_at) values
  ('81000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000001', 'Un', 'C', 'un@test.local', 'active', '{hyrox}', now(), now() - interval '200 days'),
  ('81000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000000', '60000000-0000-0000-0000-000000000002', 'Deux', 'C', 'deux@test.local', 'active', '{}', null, now() - interval '200 days'),
  ('81000000-0000-0000-0000-000000000003', '8a000000-0000-0000-0000-000000000000', null, 'Prospect', 'C', null, 'prospect', '{}', null, now() - interval '2 days'),
  ('81000000-0000-0000-0000-000000000004', '8a000000-0000-0000-0000-000000000000', null, 'Essai', 'C', null, 'prospect', '{essai}', null, now() - interval '2 days');
insert into public.credit_ledger (gym_id, member_id, delta, reason) values
  ('8a000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000001', 5, 'purchase');

insert into public.disciplines (id, gym_id, name, color) values
  ('84000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000000', 'Hyrox', '#f59e0b'),
  ('84000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000000', 'Run', '#16a34a');
insert into public.class_sessions (id, gym_id, discipline_id, starts_at, ends_at, capacity) values
  ('86000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000000', '84000000-0000-0000-0000-000000000001', now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 10),
  ('86000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000000', '84000000-0000-0000-0000-000000000002', now() - interval '40 days', now() - interval '40 days' + interval '1 hour', 10);
insert into public.bookings (gym_id, session_id, member_id, status) values
  ('8a000000-0000-0000-0000-000000000000', '86000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'attended'),
  ('8a000000-0000-0000-0000-000000000000', '86000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000002', 'attended');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.names(p_filters jsonb) returns text language sql as $$
  select string_agg(first_name, ',' order by first_name)
  from public.filter_members('8a000000-0000-0000-0000-000000000000', p_filters);
$$;

select pg_temp.login_as('60000000-0000-0000-0000-000000000003');
select is(pg_temp.names('{}'), 'Deux,Essai,Prospect,Un', 'filtres vides : toute la salle');
select is(pg_temp.names('{"statuses": ["prospect"]}'), 'Essai,Prospect', 'filtre statut');
select is(pg_temp.names('{"tags": ["hyrox", "x"]}'), 'Un', 'filtre tags (au moins un)');
select is(pg_temp.names('{"statuses": ["active"], "inactive_days": 14}'), 'Deux', 'inactifs depuis 14 jours');
select is(pg_temp.names('{"discipline_id": "84000000-0000-0000-0000-000000000001"}'), 'Un', 'discipline pratiquée');
select is(pg_temp.names('{"statuses": ["active"], "max_credits": 0}'), 'Deux', 'crédits ≤ N');
select is(pg_temp.names('{"joined_since": "2026-01-01", "statuses": ["prospect"]}'), 'Essai,Prospect', 'inscrits depuis');
select is(pg_temp.names('{"birthday_month": true}'), 'Un', 'anniversaire ce mois-ci');
select is(pg_temp.names('{"email_consent": true}'), 'Un', 'consentement email');

insert into public.segments (id, gym_id, name, filters) values
  ('87000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000000', 'Inactifs', '{"statuses": ["active"], "inactive_days": 14}');
select is((select string_agg(first_name, ',') from public.segment_members('87000000-0000-0000-0000-000000000001')),
  'Deux', 'segment enregistré');

select is((select stage from public.crm_pipeline('8a000000-0000-0000-0000-000000000000') where first_name = 'Prospect'), 'lead', 'pipeline : prospect');
select is((select stage from public.crm_pipeline('8a000000-0000-0000-0000-000000000000') where first_name = 'Essai'), 'trial', 'pipeline : essai (tag)');
select is((select stage from public.crm_pipeline('8a000000-0000-0000-0000-000000000000') where first_name = 'Un'), 'active', 'pipeline : actif');

select is((select count(*) from public.search_members('8a000000-0000-0000-0000-000000000000', null, null, 20, 0, 'hyrox')),
  1::bigint, 'recherche : filtre par tag');

-- RLS segments
select pg_temp.login_as('60000000-0000-0000-0000-000000000004');
select is((select count(*) from public.segments), 0::bigint, 'accueil : ne voit pas les segments');
select throws_ok($$insert into public.segments (gym_id, name) values ('8a000000-0000-0000-0000-000000000000', 'X')$$,
  '42501', null, 'accueil : ne crée pas de segment');
select pg_temp.login_as('60000000-0000-0000-0000-000000000005');
select is((select count(*) from public.segment_members('87000000-0000-0000-0000-000000000001')), 0::bigint,
  'autre salle : segment invisible');
select pg_temp.login_as('60000000-0000-0000-0000-000000000001');
select is((select count(*) from public.filter_members('8a000000-0000-0000-0000-000000000000', '{}')), 1::bigint,
  'adhérent : ne voit que sa fiche');
select pg_temp.logout();

select * from finish();
rollback;
