-- Vues enregistrées : vues personnelles (créateur seul), vues d'équipe (gérant), colonnes
-- immuables, contraintes, isolation entre salles, suppression du compte de l'auteur.
begin;
select plan(36);

insert into auth.users (id, email) values
  ('f0000002-0000-0000-0000-000000000001', 'v-gerant@test.local'),
  ('f0000002-0000-0000-0000-000000000002', 'v-accueil@test.local'),
  ('f0000002-0000-0000-0000-000000000003', 'v-accueil2@test.local'),
  ('f0000002-0000-0000-0000-000000000004', 'v-coach@test.local'),
  ('f0000002-0000-0000-0000-000000000005', 'v-membre@test.local'),
  ('f0000002-0000-0000-0000-000000000006', 'v-gerant-autre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('fb000001-0000-0000-0000-000000000000', 'Salle V', 'salle-v', 'Europe/Paris'),
  ('fb000002-0000-0000-0000-000000000000', 'Salle W', 'salle-w', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('fb000001-0000-0000-0000-000000000000', 'f0000002-0000-0000-0000-000000000001', 'manager'),
  ('fb000001-0000-0000-0000-000000000000', 'f0000002-0000-0000-0000-000000000002', 'staff'),
  ('fb000001-0000-0000-0000-000000000000', 'f0000002-0000-0000-0000-000000000003', 'staff'),
  ('fb000001-0000-0000-0000-000000000000', 'f0000002-0000-0000-0000-000000000004', 'coach'),
  ('fb000001-0000-0000-0000-000000000000', 'f0000002-0000-0000-0000-000000000005', 'member'),
  ('fb000002-0000-0000-0000-000000000000', 'f0000002-0000-0000-0000-000000000006', 'manager');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- ---------------------------------------------------------------------------
-- Accueil : vues personnelles seulement
-- ---------------------------------------------------------------------------
select pg_temp.login_as('f0000002-0000-0000-0000-000000000002');
select lives_ok($$insert into public.saved_views (gym_id, object, name, layout, filters, columns, created_by)
  values ('fb000001-0000-0000-0000-000000000000', 'members', 'Mes prospects', 'table', '{"statuses": ["prospect"]}', '{contact,status}', 'f0000002-0000-0000-0000-000000000002')$$,
  'accueil : crée une vue personnelle');
select throws_ok($$insert into public.saved_views (gym_id, object, name, layout, visibility, created_by)
  values ('fb000001-0000-0000-0000-000000000000', 'members', 'Pour tous', 'table', 'team', 'f0000002-0000-0000-0000-000000000002')$$,
  '42501', null, 'accueil : pas de vue d''équipe');
select throws_ok($$insert into public.saved_views (gym_id, object, name, layout, created_by)
  values ('fb000001-0000-0000-0000-000000000000', 'members', 'Au nom d''un autre', 'table', 'f0000002-0000-0000-0000-000000000003')$$,
  '42501', null, 'accueil : pas de vue au nom d''un autre');
select is((select count(*) from public.saved_views where name = 'Mes prospects'), 1::bigint, 'accueil : voit sa vue');

select pg_temp.login_as('f0000002-0000-0000-0000-000000000003');
select is((select count(*) from public.saved_views), 0::bigint, 'autre accueil : ne voit pas une vue personnelle');

-- ---------------------------------------------------------------------------
-- Gérant : vues d'équipe, pas les vues personnelles des autres
-- ---------------------------------------------------------------------------
select pg_temp.login_as('f0000002-0000-0000-0000-000000000001');
select is((select count(*) from public.saved_views where visibility = 'private'), 0::bigint,
  'gérant : ne voit pas la vue personnelle de l''accueil');
select lives_ok($$insert into public.saved_views (gym_id, object, name, layout, visibility, sort, created_by)
  values ('fb000001-0000-0000-0000-000000000000', 'members', 'Équipe', 'table', 'team', 'recent', 'f0000002-0000-0000-0000-000000000001')$$,
  'gérant : crée une vue d''équipe');
select lives_ok($$insert into public.saved_views (gym_id, object, name, layout, created_by)
  values ('fb000001-0000-0000-0000-000000000000', 'members', 'Perso gérant', 'table', 'f0000002-0000-0000-0000-000000000001')$$,
  'gérant : crée une vue personnelle');

select pg_temp.login_as('f0000002-0000-0000-0000-000000000002');
select is((select count(*) from public.saved_views where visibility = 'team'), 1::bigint, 'accueil : voit la vue d''équipe');
select pg_temp.login_as('f0000002-0000-0000-0000-000000000004');
select is((select string_agg(name, ',') from public.saved_views), 'Équipe', 'coach : la vue d''équipe seulement');
select pg_temp.login_as('f0000002-0000-0000-0000-000000000005');
select is((select count(*) from public.saved_views), 0::bigint, 'adhérent : aucune vue');

-- ---------------------------------------------------------------------------
-- Accueil : ne touche pas à la vue d'équipe, gère la sienne sans la partager
-- ---------------------------------------------------------------------------
select pg_temp.login_as('f0000002-0000-0000-0000-000000000002');
update public.saved_views set name = 'Équipe modifiée' where name = 'Équipe';
select is((select name from public.saved_views where visibility = 'team'), 'Équipe', 'accueil : la vue d''équipe reste intacte');
delete from public.saved_views where name = 'Équipe';
select is((select count(*) from public.saved_views where name = 'Équipe'), 1::bigint, 'accueil : ne supprime pas la vue d''équipe');
select throws_ok($$update public.saved_views set visibility = 'team' where name = 'Mes prospects'$$,
  '42501', null, 'accueil : ne partage pas sa vue');
select lives_ok($$update public.saved_views set name = 'Mes prospects 2', sort = 'name_desc', columns = '{contact}' where name = 'Mes prospects'$$,
  'accueil : modifie sa vue');
select is((select name || ':' || sort from public.saved_views where visibility = 'private'), 'Mes prospects 2:name_desc', 'modification enregistrée');
select throws_ok($$update public.saved_views set gym_id = 'fb000002-0000-0000-0000-000000000000' where name = 'Mes prospects 2'$$,
  '42501', null, 'la salle d''une vue ne change pas');

-- ---------------------------------------------------------------------------
-- Gérant : renomme, partage sa vue, ne s'approprie pas celle d'un autre
-- ---------------------------------------------------------------------------
select pg_temp.logout();
insert into public.saved_views (gym_id, object, name, layout, visibility, created_by)
  values ('fb000001-0000-0000-0000-000000000000', 'members', 'Équipe B', 'table', 'team', 'f0000002-0000-0000-0000-000000000002');
select pg_temp.login_as('f0000002-0000-0000-0000-000000000001');
select lives_ok($$update public.saved_views set name = 'Équipe renommée' where name = 'Équipe'$$, 'gérant : renomme la vue d''équipe');
select throws_ok($$update public.saved_views set visibility = 'private' where name = 'Équipe B'$$,
  '42501', null, 'gérant : ne rend pas personnelle une vue d''équipe créée par un autre');
select lives_ok($$update public.saved_views set visibility = 'team' where name = 'Perso gérant'$$, 'gérant : partage sa vue personnelle');
select is((select visibility from public.saved_views where name = 'Perso gérant'), 'team', 'vue partagée');

-- ---------------------------------------------------------------------------
-- Planning : un coach garde ses vues personnelles (couleur rangée dans group_by)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('f0000002-0000-0000-0000-000000000004');
select lives_ok($$insert into public.saved_views (gym_id, object, name, layout, filters, group_by, created_by)
  values ('fb000001-0000-0000-0000-000000000000', 'planning', 'Mes matins', 'day', '{"mine": true}', 'coach', 'f0000002-0000-0000-0000-000000000004')$$,
  'coach : crée une vue personnelle du planning');
select throws_ok($$insert into public.saved_views (gym_id, object, name, layout, visibility, created_by)
  values ('fb000001-0000-0000-0000-000000000000', 'planning', 'Pour tous', 'week', 'team', 'f0000002-0000-0000-0000-000000000004')$$,
  '42501', null, 'coach : pas de vue d''équipe du planning');
select is((select layout || ':' || group_by from public.saved_views where name = 'Mes matins'), 'day:coach', 'coach : voit sa vue du planning');
select pg_temp.logout();
select throws_ok($$insert into public.saved_views (gym_id, object, name, layout, visibility) values ('fb000001-0000-0000-0000-000000000000', 'planning', 'Tableau', 'table', 'team')$$,
  '23514', null, 'planning : disposition semaine ou jour seulement');

-- ---------------------------------------------------------------------------
-- Autre salle
-- ---------------------------------------------------------------------------
select pg_temp.login_as('f0000002-0000-0000-0000-000000000006');
select is((select count(*) from public.saved_views), 0::bigint, 'autre salle : aucune vue');
select throws_ok($$insert into public.saved_views (gym_id, object, name, layout, visibility, created_by)
  values ('fb000001-0000-0000-0000-000000000000', 'members', 'Intrus', 'table', 'team', 'f0000002-0000-0000-0000-000000000006')$$,
  '42501', null, 'autre salle : pas de vue chez les autres');

-- ---------------------------------------------------------------------------
-- Contraintes
-- ---------------------------------------------------------------------------
select pg_temp.logout();
select throws_ok($$insert into public.saved_views (gym_id, object, name, layout, visibility) values ('fb000001-0000-0000-0000-000000000000', 'members', '  ', 'table', 'team')$$,
  '23514', null, 'nom vide refusé');
select throws_ok($$insert into public.saved_views (gym_id, object, name, layout, visibility, columns)
  values ('fb000001-0000-0000-0000-000000000000', 'members', 'Trop', 'table', 'team', (select array_agg('c' || g) from generate_series(1, 41) g))$$,
  '23514', null, '41 colonnes refusées');
select throws_ok($$insert into public.saved_views (gym_id, object, name, layout, visibility, filters)
  values ('fb000001-0000-0000-0000-000000000000', 'members', 'Gros', 'table', 'team', jsonb_build_object('x', repeat('a', 9000)))$$,
  '23514', null, 'filtres trop gros refusés');
select throws_ok($$insert into public.saved_views (gym_id, object, name, layout, visibility) values ('fb000001-0000-0000-0000-000000000000', 'members', 'Semaine', 'week', 'team')$$,
  '23514', null, 'disposition incohérente avec l''objet');
select throws_ok($$insert into public.saved_views (gym_id, object, name, layout, visibility, created_by) values ('fb000001-0000-0000-0000-000000000000', 'members', 'Orpheline', 'table', 'private', null)$$,
  '23514', null, 'une vue personnelle a un propriétaire');
select lives_ok($$insert into public.saved_views (gym_id, object, name, layout, visibility, created_by) values ('fb000001-0000-0000-0000-000000000000', 'members', 'Sans auteur', 'table', 'team', null)$$,
  'une vue d''équipe peut n''avoir aucun auteur');

-- ---------------------------------------------------------------------------
-- Suppression du compte de l'auteur
-- ---------------------------------------------------------------------------
select lives_ok($$delete from auth.users where id = 'f0000002-0000-0000-0000-000000000002'$$, 'compte de l''accueil supprimé');
select is((select count(*) from public.saved_views where name = 'Mes prospects 2'), 0::bigint, 'ses vues personnelles disparaissent');
select is((select created_by is null from public.saved_views where name = 'Équipe B'), true, 'sa vue d''équipe reste, sans auteur');

select * from finish();
rollback;
