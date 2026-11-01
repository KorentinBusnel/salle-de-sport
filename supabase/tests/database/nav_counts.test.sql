-- Pastilles de la barre latérale : comptages par rôle, refus hors de l'équipe ; un envoi
-- automatique ne répond pas à un adhérent, un message direct de l'équipe si.
begin;
select plan(8);

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
insert into public.members (id, gym_id, first_name, last_name, status, created_at) values
  ('e1000001-0000-0000-0000-000000000001', 'ea000001-0000-0000-0000-000000000000', 'Pia', 'Prospect', 'prospect', now()),
  ('e1000001-0000-0000-0000-000000000002', 'ea000001-0000-0000-0000-000000000000', 'Ali', 'Actif', 'active',
   now() - interval '10 days');
insert into public.interactions (gym_id, member_id, channel, direction, summary, occurred_at) values
  ('ea000001-0000-0000-0000-000000000000', 'e1000001-0000-0000-0000-000000000002', 'email', 'inbound', 'Question',
   now() - interval '1 day');
-- Après la question : un avis automatique (séance annulée), journalisé comme un email sortant.
select private.enqueue_message('e1000001-0000-0000-0000-000000000002', 'session_cancelled',
  'Séance annulée', 'Votre séance de demain est annulée.');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('e0000001-0000-0000-0000-000000000001');
select is((select prospects from public.nav_counts('ea000001-0000-0000-0000-000000000000')), 1, 'gérant : prospects');
select is((select unanswered from public.nav_counts('ea000001-0000-0000-0000-000000000000')), 1,
  'gérant : message sans réponse, malgré un avis automatique envoyé après');
select is((select total from public.crm_todo('ea000001-0000-0000-0000-000000000000') where kind = 'unanswered'), 1,
  'gérant : à faire, l''avis automatique ne vaut pas réponse');
select is((select last_activity_at from public.crm_pipeline('ea000001-0000-0000-0000-000000000000')
           where member_id = 'e1000001-0000-0000-0000-000000000002')::date, (now() - interval '1 day')::date,
  'pipeline : la date d''activité ignore l''avis automatique');
-- Réponse directe de l'équipe : le message n'attend plus.
reset role;
select private.enqueue_message('e1000001-0000-0000-0000-000000000002', 'direct', 'Réponse', 'Bonjour, oui.');
select pg_temp.login_as('e0000001-0000-0000-0000-000000000001');
select is((select unanswered from public.nav_counts('ea000001-0000-0000-0000-000000000000')), 0,
  'gérant : un message direct répond');
select pg_temp.login_as('e0000001-0000-0000-0000-000000000002');
select is((select prospects from public.nav_counts('ea000001-0000-0000-0000-000000000000')), 1, 'accueil : prospects');
select is((select unanswered from public.nav_counts('ea000001-0000-0000-0000-000000000000')), null, 'accueil : pas de CRM');
select pg_temp.login_as('e0000001-0000-0000-0000-000000000003');
select throws_ok($$select * from public.nav_counts('ea000001-0000-0000-0000-000000000000')$$,
  'P0001', 'forbidden', 'adhérent : refusé');

select * from finish();
rollback;
