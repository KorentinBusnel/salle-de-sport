-- Recherche d'adhérents (search_members) : nom/prénom dans les deux ordres, casse et accents,
-- formats de téléphone, filtre de statut, pagination, cloisonnement par rôle et par salle.
-- Les tests créent leurs propres données (salles S et T) et ne dépendent pas du seed.
begin;
select plan(26);

-- ---------------------------------------------------------------------------
-- Données de test
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-000000000001', 'marie@test.local'),
  ('20000000-0000-0000-0000-000000000002', 'accueil-s@test.local');

insert into public.gyms (id, name, slug) values
  ('da000000-0000-0000-0000-000000000000', 'Salle S', 'salle-s'),
  ('db000000-0000-0000-0000-000000000000', 'Salle T', 'salle-t');

insert into public.gym_roles (gym_id, profile_id, role) values
  ('da000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'member'),
  ('da000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'staff');

insert into public.members (id, gym_id, profile_id, first_name, last_name, email, phone, status) values
  ('d1000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'Marie', 'Dupont', 'marie.dupont@test.local', '06 12 34 56 78', 'active'),
  ('d1000000-0000-0000-0000-000000000002', 'da000000-0000-0000-0000-000000000000', null, 'Hélène', 'Lefèvre', null, '+33 7 98 76 54 32', 'active'),
  ('d1000000-0000-0000-0000-000000000003', 'da000000-0000-0000-0000-000000000000', null, 'Jean', 'Dupont', 'jean@exemple.fr', '0033 6 99 88 77 66', 'prospect'),
  ('d1000000-0000-0000-0000-000000000004', 'da000000-0000-0000-0000-000000000000', null, 'Zoé', 'Abadie', 'zoe@test.local', null, 'suspended'),
  ('d1000000-0000-0000-0000-000000000005', 'da000000-0000-0000-0000-000000000000', null, 'Marc', 'Martin', null, '0611223344', 'cancelled'),
  ('d2000000-0000-0000-0000-000000000006', 'db000000-0000-0000-0000-000000000000', null, 'Marie', 'Dupont', 'marie.t@test.local', '06 12 34 56 78', 'active');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
-- Noms trouvés (« Nom Prénom »), dans l'ordre renvoyé, pour la salle S.
create function pg_temp.found(
  p_query text,
  p_statuses public.member_status[] default null,
  p_gym_id uuid default 'da000000-0000-0000-0000-000000000000'
) returns text[] language sql as $$
  select coalesce(array_agg(last_name || ' ' || first_name), '{}')
  from public.search_members(p_gym_id, p_query, p_statuses);
$$;

-- ---------------------------------------------------------------------------
-- Accueil de la salle S : texte
-- ---------------------------------------------------------------------------
select pg_temp.login_as('20000000-0000-0000-0000-000000000002');

select is(pg_temp.found(null), array['Abadie Zoé', 'Dupont Jean', 'Dupont Marie', 'Lefèvre Hélène', 'Martin Marc'], 'requête vide : toutes les fiches, triées par nom puis prénom');
select is(pg_temp.found('   '), array['Abadie Zoé', 'Dupont Jean', 'Dupont Marie', 'Lefèvre Hélène', 'Martin Marc'], 'requête blanche : toutes les fiches');
select is(pg_temp.found('marie dupont'), array['Dupont Marie'], 'prénom puis nom');
select is(pg_temp.found('Dupont  Marie'), array['Dupont Marie'], 'nom puis prénom');
select is(pg_temp.found('DUPONT'), array['Dupont Jean', 'Dupont Marie'], 'insensible à la casse');
select is(pg_temp.found('dupónt'), array['Dupont Jean', 'Dupont Marie'], 'insensible aux accents (requête accentuée)');
select is(pg_temp.found('helene LEFEVRE'), array['Lefèvre Hélène'], 'insensible aux accents (fiche accentuée)');
select is(pg_temp.found('lef'), array['Lefèvre Hélène'], 'début de nom');
select is(pg_temp.found('zoe@test'), array['Abadie Zoé'], 'recherche par email');
select is(pg_temp.found('marie jean'), '{}'::text[], 'tous les mots doivent correspondre');
select is(pg_temp.found('%'), '{}'::text[], 'les jokers LIKE sont pris littéralement');

-- ---------------------------------------------------------------------------
-- Téléphone
-- ---------------------------------------------------------------------------
select is(pg_temp.found('0612345678'), array['Dupont Marie'], 'téléphone : 0612345678');
select is(pg_temp.found('+33 6 12 34 56 78'), array['Dupont Marie'], 'téléphone : +33 6 12 34 56 78');
select is(pg_temp.found('06.12.34'), array['Dupont Marie'], 'téléphone : début avec séparateurs');
select is(pg_temp.found('06 99 88'), array['Dupont Jean'], 'téléphone enregistré en 0033…');
select is(pg_temp.found('7654'), array['Lefèvre Hélène'], 'téléphone : 4 chiffres au milieu du numéro');

-- ---------------------------------------------------------------------------
-- Statut et pagination
-- ---------------------------------------------------------------------------
select is(pg_temp.found(null, array['active']::public.member_status[]), array['Dupont Marie', 'Lefèvre Hélène'], 'filtre de statut');
select is(pg_temp.found('dupont', array['prospect', 'suspended']::public.member_status[]), array['Dupont Jean'], 'filtre de statut combiné à la requête');

select results_eq(
  $$select last_name || ' ' || first_name, total_count
    from public.search_members('da000000-0000-0000-0000-000000000000', null, null, 2, 0)$$,
  $$values ('Abadie Zoé', 5::bigint), ('Dupont Jean', 5::bigint)$$,
  'pagination : première page de 2, total 5'
);
select results_eq(
  $$select last_name || ' ' || first_name, total_count
    from public.search_members('da000000-0000-0000-0000-000000000000', 'dupont', null, 1, 1)$$,
  $$values ('Dupont Marie', 2::bigint)$$,
  'pagination : deuxième page, total des résultats filtrés'
);

-- ---------------------------------------------------------------------------
-- Cloisonnement
-- ---------------------------------------------------------------------------
select is(pg_temp.found('marie', null, 'db000000-0000-0000-0000-000000000000'), '{}'::text[], 'l''accueil de S ne trouve rien dans la salle T');
select is(pg_temp.found(null, null, 'db000000-0000-0000-0000-000000000000'), '{}'::text[], 'l''accueil de S ne liste rien de la salle T');

select pg_temp.login_as('20000000-0000-0000-0000-000000000001');
select is(pg_temp.found(null), array['Dupont Marie'], 'un adhérent ne trouve que sa fiche');
select is(pg_temp.found('jean'), '{}'::text[], 'un adhérent ne trouve pas les autres adhérents');

select pg_temp.logout();
select is(pg_temp.found('marie', null, 'db000000-0000-0000-0000-000000000000'), array['Dupont Marie'], 'le filtre de salle renvoie bien la fiche de T à qui peut la voir');

select throws_ok(
  $$set local role anon; select * from public.search_members('da000000-0000-0000-0000-000000000000', 'marie')$$,
  '42501', null, 'un visiteur non connecté ne peut pas chercher'
);
select pg_temp.logout();

select * from finish();
rollback;
