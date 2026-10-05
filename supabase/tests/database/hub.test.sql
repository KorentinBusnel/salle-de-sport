-- Hub 360° : conversations privées, session_stats, message direct, journal IA.
begin;
select plan(15);

insert into auth.users (id, email) values
  ('c0000001-0000-0000-0000-000000000001', 'h-gerant@test.local'),
  ('c0000001-0000-0000-0000-000000000002', 'h-gerant2@test.local'),
  ('c0000001-0000-0000-0000-000000000003', 'h-accueil@test.local'),
  ('c0000001-0000-0000-0000-000000000004', 'h-membre@test.local'),
  ('c0000001-0000-0000-0000-000000000005', 'h-gerant-autre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('ca000001-0000-0000-0000-000000000000', 'Salle H', 'salle-h-hub', 'Europe/Paris'),
  ('cb000001-0000-0000-0000-000000000000', 'Salle I', 'salle-i-hub', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('ca000001-0000-0000-0000-000000000000', 'c0000001-0000-0000-0000-000000000001', 'manager'),
  ('ca000001-0000-0000-0000-000000000000', 'c0000001-0000-0000-0000-000000000002', 'manager'),
  ('ca000001-0000-0000-0000-000000000000', 'c0000001-0000-0000-0000-000000000003', 'staff'),
  ('cb000001-0000-0000-0000-000000000000', 'c0000001-0000-0000-0000-000000000005', 'manager');
insert into public.members (id, gym_id, profile_id, first_name, last_name, email, status) values
  ('c1000001-0000-0000-0000-000000000001', 'ca000001-0000-0000-0000-000000000000', 'c0000001-0000-0000-0000-000000000004', 'Hugo', 'H', 'hugo@test.local', 'active'),
  ('c2000001-0000-0000-0000-000000000001', 'cb000001-0000-0000-0000-000000000000', null, 'Ivy', 'I', null, 'active');
insert into public.disciplines (id, gym_id, name, color) values
  ('c4000001-0000-0000-0000-000000000001', 'ca000001-0000-0000-0000-000000000000', 'CrossFit', '#dc2626');
-- Deux CrossFit passés à 18 h 30 (Paris), un à 7 h.
insert into public.class_sessions (id, gym_id, discipline_id, starts_at, ends_at, capacity) values
  ('c6000001-0000-0000-0000-000000000001', 'ca000001-0000-0000-0000-000000000000', 'c4000001-0000-0000-0000-000000000001', '2026-03-10 17:30+00', '2026-03-10 18:30+00', 10),
  ('c6000001-0000-0000-0000-000000000002', 'ca000001-0000-0000-0000-000000000000', 'c4000001-0000-0000-0000-000000000001', '2026-03-12 17:30+00', '2026-03-12 18:30+00', 10),
  ('c6000001-0000-0000-0000-000000000003', 'ca000001-0000-0000-0000-000000000000', 'c4000001-0000-0000-0000-000000000001', '2026-03-12 06:00+00', '2026-03-12 07:00+00', 10);
insert into public.bookings (gym_id, session_id, member_id, status) values
  ('ca000001-0000-0000-0000-000000000000', 'c6000001-0000-0000-0000-000000000001', 'c1000001-0000-0000-0000-000000000001', 'no_show'),
  ('ca000001-0000-0000-0000-000000000000', 'c6000001-0000-0000-0000-000000000002', 'c1000001-0000-0000-0000-000000000001', 'attended');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- Conversations
select pg_temp.login_as('c0000001-0000-0000-0000-000000000001');
insert into public.ai_conversations (id, gym_id, profile_id, title) values
  ('c7000001-0000-0000-0000-000000000001', 'ca000001-0000-0000-0000-000000000000', 'c0000001-0000-0000-0000-000000000001', 'Semaine');
insert into public.ai_messages (gym_id, conversation_id, role, content) values
  ('ca000001-0000-0000-0000-000000000000', 'c7000001-0000-0000-0000-000000000001', 'user', '{"text": "Résume-moi la semaine"}');
select is((select count(*) from public.ai_messages), 1::bigint, 'gérant : voit ses messages');
select throws_ok($$insert into public.ai_conversations (gym_id, profile_id) values
  ('ca000001-0000-0000-0000-000000000000', 'c0000001-0000-0000-0000-000000000002')$$,
  '42501', null, 'pas de conversation au nom d''un autre');
select pg_temp.login_as('c0000001-0000-0000-0000-000000000002');
select is((select count(*) from public.ai_conversations), 0::bigint, 'autre gérant : ne voit pas les conversations d''un collègue');
select throws_ok($$insert into public.ai_messages (gym_id, conversation_id, role, content) values
  ('ca000001-0000-0000-0000-000000000000', 'c7000001-0000-0000-0000-000000000001', 'user', '{"text": "x"}')$$,
  '42501', null, 'pas d''écriture dans la conversation d''un autre');
select pg_temp.login_as('c0000001-0000-0000-0000-000000000003');
select throws_ok($$insert into public.ai_conversations (gym_id, profile_id) values
  ('ca000001-0000-0000-0000-000000000000', 'c0000001-0000-0000-0000-000000000003')$$,
  '42501', null, 'accueil : pas d''assistant');
select pg_temp.login_as('c0000001-0000-0000-0000-000000000005');
select is((select count(*) from public.ai_messages), 0::bigint, 'autre salle : rien');

-- Statistiques de séances
select pg_temp.login_as('c0000001-0000-0000-0000-000000000001');
select is((select count(*) from public.session_stats('ca000001-0000-0000-0000-000000000000', '2026-03-01', '2026-03-31',
  'c4000001-0000-0000-0000-000000000001', '18:30')), 2::bigint, 'stats : filtre discipline et heure locale');
select is((select sum(no_show) from public.session_stats('ca000001-0000-0000-0000-000000000000', '2026-03-01', '2026-03-31',
  null, '18:30'))::integer, 1, 'stats : absences');
select pg_temp.login_as('c0000001-0000-0000-0000-000000000003');
select throws_ok($$select * from public.session_stats('ca000001-0000-0000-0000-000000000000', '2026-03-01', '2026-03-31')$$,
  'P0001', 'forbidden', 'stats : réservées au gérant');

-- Message direct
select pg_temp.login_as('c0000001-0000-0000-0000-000000000001');
select is(public.send_direct_message('ca000001-0000-0000-0000-000000000000',
  array['c1000001-0000-0000-0000-000000000001']::uuid[], 'Bonjour {prenom}', 'On vous attend {prenom} !'), 1, 'message direct mis en file');
select throws_ok($$select public.send_direct_message('ca000001-0000-0000-0000-000000000000',
  array['c2000001-0000-0000-0000-000000000001']::uuid[], 'x', 'y')$$,
  'P0001', 'member_not_found', 'message direct : pas vers une autre salle');
select pg_temp.logout();
select is((select subject from public.outbound_messages where member_id = 'c1000001-0000-0000-0000-000000000001' and origin = 'direct'),
  'Bonjour Hugo', 'variables rendues, origine directe');

-- Journal IA
select pg_temp.login_as('c0000001-0000-0000-0000-000000000001');
select lives_ok($$select public.log_ai_call('ca000001-0000-0000-0000-000000000000',
  array['get_kpis'], 1200, 300, 'claude-sonnet-5-5', 'c7000001-0000-0000-0000-000000000001')$$, 'appel journalisé');
select is((select details ->> 'model' from public.audit_log where action = 'ai.query' and gym_id = 'ca000001-0000-0000-0000-000000000000'),
  'claude-sonnet-5-5', 'journal : modèle et jetons, sans contenu');
select pg_temp.login_as('c0000001-0000-0000-0000-000000000003');
select throws_ok($$select public.log_ai_call('ca000001-0000-0000-0000-000000000000', '{}', 0, 0, 'x')$$,
  'P0001', 'forbidden', 'journal : réservé au gérant');
select pg_temp.logout();

select * from finish();
rollback;
