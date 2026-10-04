-- File d'envoi : avis d'annulation, historique, idempotence, RLS (adhérent, salle).
begin;
select plan(14);

insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-000000000001', 'o-un@test.local'),
  ('30000000-0000-0000-0000-000000000002', 'o-deux@test.local'),
  ('30000000-0000-0000-0000-000000000003', 'o-gerant@test.local'),
  ('30000000-0000-0000-0000-000000000004', 'o-gerant-autre@test.local'),
  ('30000000-0000-0000-0000-000000000005', 'o-accueil@test.local');

insert into public.gyms (id, name, slug, timezone) values
  ('ea000000-0000-0000-0000-000000000000', 'Salle O', 'salle-o', 'Europe/Paris'),
  ('eb000000-0000-0000-0000-000000000000', 'Salle P', 'salle-p', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('ea000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003', 'manager'),
  ('eb000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000004', 'manager'),
  ('ea000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000005', 'staff');

insert into public.members (id, gym_id, profile_id, first_name, last_name, email, status) values
  ('e1000000-0000-0000-0000-000000000001', 'ea000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000001', 'Un', 'O', 'un@test.local', 'active'),
  ('e1000000-0000-0000-0000-000000000002', 'ea000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000002', 'Deux', 'O', null, 'active');
insert into public.credit_ledger (gym_id, member_id, delta, reason) values
  ('ea000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000001', 2, 'purchase'),
  ('ea000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000002', 2, 'purchase');
insert into public.disciplines (id, gym_id, name, color) values
  ('e4000000-0000-0000-0000-000000000001', 'ea000000-0000-0000-0000-000000000000', 'Hyrox', '#f59e0b');
insert into public.class_sessions (id, gym_id, discipline_id, starts_at, ends_at, capacity) values
  ('e6000000-0000-0000-0000-000000000001', 'ea000000-0000-0000-0000-000000000000', 'e4000000-0000-0000-0000-000000000001',
   '2030-03-12 17:30:00+00', '2030-03-12 18:30:00+00', 1);

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- Un inscrit confirmé, l'autre en liste d'attente.
select pg_temp.login_as('30000000-0000-0000-0000-000000000001');
select public.book_session('e6000000-0000-0000-0000-000000000001');
select pg_temp.login_as('30000000-0000-0000-0000-000000000002');
select public.book_session('e6000000-0000-0000-0000-000000000001');
select pg_temp.logout();

select is(private.session_label('e6000000-0000-0000-0000-000000000001'), 'Hyrox du 12/03 à 18h30',
  'libellé de séance dans le fuseau de la salle');

select pg_temp.login_as('30000000-0000-0000-0000-000000000003');
select public.cancel_session('e6000000-0000-0000-0000-000000000001', 'Coach malade');
select pg_temp.logout();

select is((select count(*) from public.outbound_messages where ref_id = 'e6000000-0000-0000-0000-000000000001'),
  2::bigint, 'annulation : confirmé et liste d''attente prévenus');
select is((select subject from public.outbound_messages where member_id = 'e1000000-0000-0000-0000-000000000001'),
  'Séance annulée : Hyrox du 12/03 à 18h30', 'annulation : objet du message');
select ok((select body like '%(Coach malade)%' from public.outbound_messages where member_id = 'e1000000-0000-0000-0000-000000000001'),
  'annulation : motif repris dans le message');
select is((select to_address from public.outbound_messages where member_id = 'e1000000-0000-0000-0000-000000000001'),
  'un@test.local', 'adresse email figée à l''envoi');
select is((select count(*) from public.interactions where member_id = 'e1000000-0000-0000-0000-000000000001' and direction = 'outbound'),
  1::bigint, 'message ajouté à l''historique de l''adhérent');

select is(private.process_outbound_messages(), 2, 'livraison simulée : messages journalisés');
select is((select count(*) from public.outbound_messages where status = 'logged' and processed_at is not null
  and member_id in ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002')),
  2::bigint, 'statut logged');

select isnt(private.enqueue_message('e1000000-0000-0000-0000-000000000001', 'automation', 'Bienvenue', 'Bonjour', null, 'welcome:x'),
  null, 'mise en file avec clé');
select is(private.enqueue_message('e1000000-0000-0000-0000-000000000001', 'automation', 'Bienvenue', 'Bonjour', null, 'welcome:x'),
  null, 'idempotence : même clé ignorée');

-- RLS
select pg_temp.login_as('30000000-0000-0000-0000-000000000002');
select is((select count(*) from public.outbound_messages), 1::bigint, 'adhérent : ne voit que ses messages');
select pg_temp.login_as('30000000-0000-0000-0000-000000000005');
select is((select count(*) from public.outbound_messages), 0::bigint, 'accueil : ne voit pas la file d''envoi');
select pg_temp.login_as('30000000-0000-0000-0000-000000000004');
select is((select count(*) from public.outbound_messages), 0::bigint, 'autre salle : ne voit rien');
select throws_ok($$insert into public.outbound_messages (gym_id, member_id, subject, body, origin) values
  ('ea000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000001', 'x', 'y', 'campaign')$$,
  '42501', null, 'pas d''écriture directe');
select pg_temp.logout();

select * from finish();
rollback;
