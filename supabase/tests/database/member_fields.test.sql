-- Champs personnalisés des adhérents : définitions (gérant), valeurs (accueil, gérant, coachs de
-- l'adhérent ; jamais l'adhérent), validation par type, filtres, recherche, usage, isolation.
begin;
select plan(139);

insert into auth.users (id, email) values
  ('f0000001-0000-0000-0000-000000000001', 'f-gerant@test.local'),
  ('f0000001-0000-0000-0000-000000000002', 'f-accueil@test.local'),
  ('f0000001-0000-0000-0000-000000000003', 'f-coach1@test.local'),
  ('f0000001-0000-0000-0000-000000000004', 'f-coach2@test.local'),
  ('f0000001-0000-0000-0000-000000000005', 'f-membre@test.local'),
  ('f0000001-0000-0000-0000-000000000006', 'f-gerant-autre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('fa000001-0000-0000-0000-000000000000', 'Salle F', 'salle-f-fields', 'Europe/Paris'),
  ('fb000001-0000-0000-0000-000000000000', 'Salle G', 'salle-g-fields', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('fa000001-0000-0000-0000-000000000000', 'f0000001-0000-0000-0000-000000000001', 'manager'),
  ('fa000001-0000-0000-0000-000000000000', 'f0000001-0000-0000-0000-000000000002', 'staff'),
  ('fa000001-0000-0000-0000-000000000000', 'f0000001-0000-0000-0000-000000000003', 'coach'),
  ('fa000001-0000-0000-0000-000000000000', 'f0000001-0000-0000-0000-000000000004', 'coach'),
  ('fa000001-0000-0000-0000-000000000000', 'f0000001-0000-0000-0000-000000000005', 'member'),
  ('fb000001-0000-0000-0000-000000000000', 'f0000001-0000-0000-0000-000000000006', 'manager');
insert into public.coaches (id, gym_id, profile_id, display_name) values
  ('fc000001-0000-0000-0000-000000000003', 'fa000001-0000-0000-0000-000000000000', 'f0000001-0000-0000-0000-000000000003', 'Coach Un'),
  ('fc000001-0000-0000-0000-000000000004', 'fa000001-0000-0000-0000-000000000000', 'f0000001-0000-0000-0000-000000000004', 'Coach Deux');
-- Alice (compte adhérent, inscrite à la séance de Coach Un), Bruno, Zoé (sans valeur) ; Wendy ailleurs.
insert into public.members (id, gym_id, profile_id, first_name, last_name, status) values
  ('f1000001-0000-0000-0000-000000000001', 'fa000001-0000-0000-0000-000000000000', 'f0000001-0000-0000-0000-000000000005', 'Alice', 'Champ', 'active'),
  ('f1000001-0000-0000-0000-000000000002', 'fa000001-0000-0000-0000-000000000000', null, 'Bruno', 'Champ', 'active'),
  ('f1000001-0000-0000-0000-000000000003', 'fa000001-0000-0000-0000-000000000000', null, 'Zoé', 'Champ', 'prospect'),
  ('f2000001-0000-0000-0000-000000000001', 'fb000001-0000-0000-0000-000000000000', null, 'Wendy', 'Ailleurs', 'active');
insert into public.disciplines (id, gym_id, name, color) values
  ('f4000001-0000-0000-0000-000000000001', 'fa000001-0000-0000-0000-000000000000', 'Renfo', '#2563eb');
insert into public.class_sessions (id, gym_id, discipline_id, starts_at, ends_at, capacity) values
  ('f6000001-0000-0000-0000-000000000001', 'fa000001-0000-0000-0000-000000000000', 'f4000001-0000-0000-0000-000000000001', now() + interval '1 day', now() + interval '1 day 1 hour', 10);
insert into public.session_coaches (gym_id, session_id, coach_id) values
  ('fa000001-0000-0000-0000-000000000000', 'f6000001-0000-0000-0000-000000000001', 'fc000001-0000-0000-0000-000000000003');
insert into public.bookings (gym_id, session_id, member_id, status) values
  ('fa000001-0000-0000-0000-000000000000', 'f6000001-0000-0000-0000-000000000001', 'f1000001-0000-0000-0000-000000000001', 'confirmed');
-- Un champ dans l'autre salle, invisible depuis la salle F.
insert into public.member_fields (gym_id, key, label, type) values
  ('fb000001-0000-0000-0000-000000000000', 'ailleurs', 'Ailleurs', 'text');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
-- Identifiant d'un champ de la salle F par sa clé (sous les droits de l'appelant).
create function pg_temp.fid(p_key text) returns uuid language sql as $$
  select id from public.member_fields where gym_id = 'fa000001-0000-0000-0000-000000000000' and key = p_key;
$$;
-- Prénoms retenus par filter_members dans la salle F.
create function pg_temp.names(p_filters jsonb) returns text language sql as $$
  select coalesce(string_agg(first_name, ',' order by first_name), '')
  from public.filter_members('fa000001-0000-0000-0000-000000000000', p_filters);
$$;

-- ---------------------------------------------------------------------------
-- Création (gérant seulement)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('f0000001-0000-0000-0000-000000000002');
select throws_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Objectif', 'select')$$,
  'P0001', 'forbidden', 'accueil : ne crée pas de champ');
select pg_temp.login_as('f0000001-0000-0000-0000-000000000006');
select throws_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Objectif', 'select')$$,
  'P0001', 'forbidden', 'gérant d''une autre salle : refusé');

select pg_temp.login_as('f0000001-0000-0000-0000-000000000001');
select throws_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Note', 'rating')$$,
  'P0001', 'invalid_input', 'type inconnu');
select throws_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', '   ', 'text')$$,
  'P0001', 'invalid_input', 'libellé vide');
select throws_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', '***', 'text')$$,
  'P0001', 'invalid_input', 'libellé sans caractère exploitable');
select throws_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Objectif', 'select',
  '[{"value": "forme", "label": "Forme", "tone": "violet"}]')$$,
  'P0001', 'invalid_input', 'ton inconnu');
select throws_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Objectif', 'select',
  '[{"value": "Forme", "label": "Forme", "tone": "brand"}]')$$,
  'P0001', 'invalid_input', 'valeur d''option mal formée');
select throws_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Objectif', 'select',
  '[{"value": "forme", "label": "Forme", "tone": "brand"}, {"value": "forme", "label": "Santé", "tone": "neutral"}]')$$,
  'P0001', 'invalid_input', 'doublon de valeur d''option');
select throws_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Objectif', 'select', '{}')$$,
  'P0001', 'invalid_input', 'options : tableau attendu');
select throws_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Remarque', 'text',
  '[{"value": "a", "label": "A", "tone": "brand"}]')$$,
  'P0001', 'invalid_input', 'options sur un champ qui n''est pas une liste');

select lives_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', ' Objectif ', 'select',
  '[{"value": "perte_de_poids", "label": " Perte de poids ", "tone": "brand"}, {"value": "competition", "label": "Compétition", "tone": "success"}]')$$,
  'gérant : crée une liste');
select is((select key from public.member_fields where label = 'Objectif'), 'objectif', 'clé = slug du libellé, libellé nettoyé');
select is((select options from public.member_fields where key = 'objectif'),
  '[{"value": "perte_de_poids", "label": "Perte de poids", "tone": "brand"}, {"value": "competition", "label": "Compétition", "tone": "success"}]'::jsonb,
  'options normalisées');
select lives_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', '2e contact', 'text')$$, 'crée « 2e contact »');
select is((select key from public.member_fields where label = '2e contact'), 'f_2e_contact', 'clé préfixée quand elle commence par un chiffre');
select lives_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', 'OBJECTIF', 'select')$$, 'crée un homonyme');
select is((select key from public.member_fields where label = 'OBJECTIF'), 'objectif_2', 'clé dédoublonnée par suffixe');
select is((select array_agg(key order by position) from public.member_fields where gym_id = 'fa000001-0000-0000-0000-000000000000'),
  array['objectif', 'f_2e_contact', 'objectif_2'], 'chaque champ arrive en dernier');
select lives_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', repeat('a', 60), 'text'),
  public.create_member_field('fa000001-0000-0000-0000-000000000000', repeat('a', 60), 'text')$$, 'libellés longs');
select is((select array_agg(length(key) order by key) from public.member_fields where label = repeat('a', 60)),
  array[40, 40], 'clé tronquée à 40 caractères, suffixe compris');
select lives_ok($$select
  public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Niveau', 'multi_select',
    '[{"value": "debutant", "label": "Débutant", "tone": "neutral"}, {"value": "confirme", "label": "Confirmé", "tone": "success"}]'),
  public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Certificat médical', 'date'),
  public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Poids', 'number'),
  public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Newsletter', 'boolean')$$,
  'autres types créés');
select is((select key from public.member_fields where label = 'Certificat médical'), 'certificat_medical', 'accents retirés de la clé');
select is((select count(*) from public.audit_log where gym_id = 'fa000001-0000-0000-0000-000000000000' and action = 'member_field.create'),
  9::bigint, 'chaque création est journalisée');

-- Plafond : 9 champs actifs, 21 de plus font 30, le 31e est refusé.
select lives_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Champ ' || i, 'text') from generate_series(1, 21) as i$$,
  'jusqu''à 30 champs actifs');
select throws_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Un de trop', 'text')$$,
  'P0001', 'too_many_fields', '31e champ actif refusé');
select lives_ok($$select public.update_member_field(pg_temp.fid('champ_1'), '{"is_active": false}')$$, 'un champ masqué');
select lives_ok($$select public.create_member_field('fa000001-0000-0000-0000-000000000000', 'Un de plus', 'text')$$,
  'un champ masqué libère une place');
select throws_ok($$select public.update_member_field(pg_temp.fid('champ_1'), '{"is_active": true}')$$,
  'P0001', 'too_many_fields', 'réactiver au-delà du plafond refusé');
select lives_ok($$select public.delete_member_field(f.id) from public.member_fields f where f.key like 'champ\_%' or f.key = 'un_de_plus'$$,
  'champs de remplissage supprimés');

-- ---------------------------------------------------------------------------
-- Modification
-- ---------------------------------------------------------------------------
select pg_temp.login_as('f0000001-0000-0000-0000-000000000002');
select throws_ok($$select public.update_member_field(pg_temp.fid('objectif'), '{"label": "But"}')$$,
  'P0001', 'forbidden', 'accueil : ne modifie pas un champ');
select pg_temp.login_as('f0000001-0000-0000-0000-000000000001');
select throws_ok($$select public.update_member_field('f9000001-0000-0000-0000-000000000000', '{"label": "But"}')$$,
  'P0001', 'field_not_found', 'champ inconnu');
select throws_ok($$select public.update_member_field(pg_temp.fid('objectif'), '{"type": "text"}')$$,
  'P0001', 'invalid_input', 'le type ne change pas');
select throws_ok($$select public.update_member_field(pg_temp.fid('objectif'), '{"key": "but"}')$$,
  'P0001', 'invalid_input', 'la clé ne change pas');
select throws_ok($$select public.update_member_field(pg_temp.fid('objectif'), '{"label": "  "}')$$,
  'P0001', 'invalid_input', 'libellé vide refusé');
select throws_ok($$select public.update_member_field(pg_temp.fid('objectif'), '{"staff_can_edit": "non"}')$$,
  'P0001', 'invalid_input', 'interrupteur : booléen attendu');
select lives_ok($$select public.update_member_field(pg_temp.fid('poids'), '{"label": "Poids (kg)", "staff_can_edit": false}')$$,
  'gérant : libellé et saisie réservée');
select is((select label || ':' || staff_can_edit from public.member_fields where key = 'poids'), 'Poids (kg):false', 'modification enregistrée');
select lives_ok($$select public.update_member_field(pg_temp.fid('objectif'), '{"options": [
  {"value": "perte_de_poids", "label": "Perte de poids", "tone": "brand"},
  {"value": "competition", "label": "Compétition", "tone": "success"},
  {"value": "forme", "label": "Forme", "tone": "neutral"}]}')$$, 'option ajoutée');
select is((select jsonb_array_length(options) from public.member_fields where key = 'objectif'), 3, 'trois options');

-- ---------------------------------------------------------------------------
-- Valeurs : droits et validation par type
-- ---------------------------------------------------------------------------
select throws_ok($$select public.set_member_field('f9000001-0000-0000-0000-000000000000', 'objectif', '"forme"')$$,
  'P0001', 'member_not_found', 'adhérent introuvable');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'inconnu', '"x"')$$,
  'P0001', 'unknown_field', 'clé inconnue');
select throws_ok($$select public.set_member_field('f2000001-0000-0000-0000-000000000001', 'objectif', '"forme"')$$,
  'P0001', 'forbidden', 'adhérent d''une autre salle');
-- texte
select is(public.set_member_field('f1000001-0000-0000-0000-000000000001', 'f_2e_contact', '"  Élodie Mère  "'),
  '"Élodie Mère"'::jsonb, 'texte nettoyé et renvoyé');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'f_2e_contact', to_jsonb(repeat('a', 301)))$$,
  'P0001', 'invalid_field_value', 'texte trop long');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'f_2e_contact', '"   "')$$,
  'P0001', 'invalid_field_value', 'texte vide');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'f_2e_contact', '12')$$,
  'P0001', 'invalid_field_value', 'texte : chaîne attendue');
-- nombre
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'poids', '"72"')$$,
  'P0001', 'invalid_field_value', 'nombre : pas une chaîne');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'poids', '72.345')$$,
  'P0001', 'invalid_field_value', 'nombre : 2 décimales au plus');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'poids', '2000000000')$$,
  'P0001', 'invalid_field_value', 'nombre hors bornes');
select is(public.set_member_field('f1000001-0000-0000-0000-000000000001', 'poids', '72.5'), '72.5'::jsonb, 'nombre accepté');
-- date
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'certificat_medical', '"2026-02-30"')$$,
  'P0001', 'invalid_field_value', 'date invalide');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'certificat_medical', '"today"')$$,
  'P0001', 'invalid_field_value', 'date : format ISO exigé');
select is(public.set_member_field('f1000001-0000-0000-0000-000000000001', 'certificat_medical', '"2026-03-15"'),
  '"2026-03-15"'::jsonb, 'date acceptée');
-- oui/non
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'newsletter', '"true"')$$,
  'P0001', 'invalid_field_value', 'oui/non : booléen attendu');
select is(public.set_member_field('f1000001-0000-0000-0000-000000000001', 'newsletter', 'true'), 'true'::jsonb, 'oui/non accepté');
-- liste
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'objectif', '"yoga"')$$,
  'P0001', 'invalid_field_value', 'option inconnue');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'objectif', '["competition"]')$$,
  'P0001', 'invalid_field_value', 'liste simple : chaîne attendue');
select is(public.set_member_field('f1000001-0000-0000-0000-000000000001', 'objectif', '"competition"'),
  '"competition"'::jsonb, 'option acceptée');
-- liste multiple
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'niveau', '"debutant"')$$,
  'P0001', 'invalid_field_value', 'liste multiple : tableau attendu');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'niveau', '[]')$$,
  'P0001', 'invalid_field_value', 'liste multiple vide');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'niveau', '["debutant", "expert"]')$$,
  'P0001', 'invalid_field_value', 'liste multiple : option inconnue');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'niveau', '["debutant", "debutant"]')$$,
  'P0001', 'invalid_field_value', 'liste multiple : doublon');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'niveau', '["debutant", 1]')$$,
  'P0001', 'invalid_field_value', 'liste multiple : chaînes seulement');
select is(public.set_member_field('f1000001-0000-0000-0000-000000000001', 'niveau', '["debutant", "confirme"]'),
  '["debutant", "confirme"]'::jsonb, 'liste multiple acceptée');
-- champ masqué, mise à jour, effacement
select lives_ok($$select public.update_member_field(pg_temp.fid('objectif_2'), '{"is_active": false}')$$, 'champ masqué');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'objectif_2', '"x"')$$,
  'P0001', 'unknown_field', 'champ inactif : inconnu');
select is(public.set_member_field('f1000001-0000-0000-0000-000000000002', 'poids', '80'), '80'::jsonb, 'gérant : champ réservé');
select is(public.set_member_field('f1000001-0000-0000-0000-000000000002', 'poids', '81'), '81'::jsonb, 'valeur remplacée');
select is((select count(*) from public.member_field_values where member_id = 'f1000001-0000-0000-0000-000000000002' and field_id = pg_temp.fid('poids')),
  1::bigint, 'une seule ligne par adhérent et champ');
select is((select updated_by from public.member_field_values where member_id = 'f1000001-0000-0000-0000-000000000002' and field_id = pg_temp.fid('poids')),
  'f0000001-0000-0000-0000-000000000001'::uuid, 'auteur de la saisie');
select is(public.set_member_field('f1000001-0000-0000-0000-000000000002', 'f_2e_contact', '"Temporaire"'), '"Temporaire"'::jsonb, 'valeur posée');
select is(public.set_member_field('f1000001-0000-0000-0000-000000000002', 'f_2e_contact', null), 'null'::jsonb, 'null efface');
select is((select count(*) from public.member_field_values where member_id = 'f1000001-0000-0000-0000-000000000002' and field_id = pg_temp.fid('f_2e_contact')),
  0::bigint, 'valeur effacée');
select is(public.set_member_field('f1000001-0000-0000-0000-000000000002', 'certificat_medical', '"2025-01-10"'), '"2025-01-10"'::jsonb, 'certificat de Bruno');
select is(public.set_member_field('f1000001-0000-0000-0000-000000000002', 'niveau', '["confirme"]'), '["confirme"]'::jsonb, 'niveau de Bruno');

-- Accueil : saisit un champ autorisé, pas un champ réservé.
select pg_temp.login_as('f0000001-0000-0000-0000-000000000002');
select is(public.set_member_field('f1000001-0000-0000-0000-000000000002', 'objectif', '"perte_de_poids"'),
  '"perte_de_poids"'::jsonb, 'accueil : champ autorisé');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000002', 'poids', '79')$$,
  'P0001', 'forbidden', 'accueil : champ réservé au gérant');
-- Coach et adhérent : aucune saisie.
select pg_temp.login_as('f0000001-0000-0000-0000-000000000003');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'objectif', '"forme"')$$,
  'P0001', 'forbidden', 'coach : pas de saisie');
select pg_temp.login_as('f0000001-0000-0000-0000-000000000005');
select throws_ok($$select public.set_member_field('f1000001-0000-0000-0000-000000000001', 'objectif', '"forme"')$$,
  'P0001', 'forbidden', 'adhérent : pas de saisie, même sur sa fiche');

-- ---------------------------------------------------------------------------
-- Lecture : équipe, coachs de l'adhérent, jamais l'adhérent ni une autre salle
-- ---------------------------------------------------------------------------
select is((select count(*) from public.member_field_values), 0::bigint, 'adhérent : ne lit aucune valeur');
select is((select count(*) from public.member_fields), 0::bigint, 'adhérent : ne voit pas les définitions');
select throws_ok($$insert into public.member_field_values (gym_id, member_id, field_id, value)
  values ('fa000001-0000-0000-0000-000000000000', 'f1000001-0000-0000-0000-000000000001', 'f9000001-0000-0000-0000-000000000000', '"x"')$$,
  '42501', null, 'adhérent : aucune écriture directe');
select pg_temp.login_as('f0000001-0000-0000-0000-000000000003');
select is((select count(distinct member_id) from public.member_field_values), 1::bigint, 'coach : les valeurs de l''inscrit à sa séance seulement');
select is((select count(*) from public.member_field_values where member_id = 'f1000001-0000-0000-0000-000000000002'), 0::bigint,
  'coach : rien sur un adhérent qui n''est pas inscrit chez lui');
select ok((select count(*) from public.member_fields) > 0, 'coach : lit les définitions');
select pg_temp.login_as('f0000001-0000-0000-0000-000000000004');
select is((select count(*) from public.member_field_values), 0::bigint, 'autre coach : aucune valeur');
select pg_temp.login_as('f0000001-0000-0000-0000-000000000006');
select is((select count(*) from public.member_fields where gym_id = 'fa000001-0000-0000-0000-000000000000'), 0::bigint,
  'autre salle : 0 champ');
select is((select count(*) from public.member_field_values), 0::bigint, 'autre salle : 0 valeur');
select pg_temp.login_as('f0000001-0000-0000-0000-000000000002');
select is((select count(*) from public.member_fields), 9::bigint, 'accueil : les champs de sa salle, pas ceux d''ailleurs');
select throws_ok($$update public.member_field_values set value = '"x"'$$, '42501', null, 'accueil : pas d''écriture directe sur les valeurs');
select throws_ok($$insert into public.member_fields (gym_id, key, label, type) values ('fa000001-0000-0000-0000-000000000000', 'x', 'X', 'text')$$,
  '42501', null, 'accueil : pas d''écriture directe sur les définitions');

-- ---------------------------------------------------------------------------
-- filter_members : clé « fields »
-- ---------------------------------------------------------------------------
-- Alice : objectif competition, niveau [debutant, confirme], poids 72.5, certificat 2026-03-15,
-- newsletter vrai, 2e contact « Élodie Mère ». Bruno : perte_de_poids, [confirme], 81, 2025-01-10.
-- Zoé : rien.
select pg_temp.login_as('f0000001-0000-0000-0000-000000000001');
select is(pg_temp.names('{"fields": [{"key": "objectif", "op": "is", "value": "competition"}]}'), 'Alice', 'is');
select is(pg_temp.names('{"fields": [{"key": "objectif", "op": "is_not", "value": "competition"}]}'), 'Bruno,Zoé', 'is_not (valeur absente comprise)');
select is(pg_temp.names('{"fields": [{"key": "f_2e_contact", "op": "contains", "value": "elodie"}]}'), 'Alice', 'contains sans casse ni accents');
select is(pg_temp.names('{"fields": [{"key": "f_2e_contact", "op": "contains", "value": "%"}]}'), '', 'contains : jokers pris littéralement');
select is(pg_temp.names('{"fields": [{"key": "objectif", "op": "is_empty"}]}'), 'Zoé', 'is_empty');
select is(pg_temp.names('{"fields": [{"key": "objectif", "op": "is_not_empty"}]}'), 'Alice,Bruno', 'is_not_empty');
select is(pg_temp.names('{"fields": [{"key": "poids", "op": "gte", "value": 75}]}'), 'Bruno', 'gte');
select is(pg_temp.names('{"fields": [{"key": "poids", "op": "lte", "value": 75}]}'), 'Alice', 'lte');
select is(pg_temp.names('{"fields": [{"key": "certificat_medical", "op": "before", "value": "2026-01-01"}]}'), 'Bruno', 'before');
select is(pg_temp.names('{"fields": [{"key": "certificat_medical", "op": "after", "value": "2026-01-01"}]}'), 'Alice', 'after');
select is(pg_temp.names('{"fields": [{"key": "niveau", "op": "has_any", "value": ["debutant"]}]}'), 'Alice', 'has_any (un élément)');
select is(pg_temp.names('{"fields": [{"key": "niveau", "op": "has_any", "value": ["confirme", "expert"]}]}'), 'Alice,Bruno', 'has_any (plusieurs)');
select is(pg_temp.names('{"fields": [{"key": "newsletter", "op": "is", "value": true}]}'), 'Alice', 'oui/non : vrai');
select is(pg_temp.names('{"fields": [{"key": "newsletter", "op": "is", "value": false}]}'), 'Bruno,Zoé', 'oui/non : absent vaut non');
select is(pg_temp.names('{"fields": [{"key": "absent", "op": "is_empty"}]}'), 'Alice,Bruno,Zoé', 'is_empty sur une clé inconnue : tout le monde');
select is(pg_temp.names('{"fields": [{"key": "absent", "op": "is", "value": "x"}]}'), '', 'is sur une clé inconnue : personne');
select is(pg_temp.names('{"fields": [{"key": "poids", "op": "between", "value": 70}]}'), '', 'opérateur inconnu : aucun résultat, aucune erreur');
select is(pg_temp.names('{"fields": [{"key": "certificat_medical", "op": "before", "value": "demain"}]}'), '', 'date mal formée : aucun résultat, aucune erreur');
select is(pg_temp.names('{"fields": [{"key": "poids", "op": "gte", "value": "75"}]}'), '', 'nombre attendu, chaîne reçue : aucun résultat');
select is(pg_temp.names('{"fields": [{"key": "objectif", "op": "is_not_empty"}, {"key": "poids", "op": "gte", "value": 75}]}'), 'Bruno', 'conditions combinées en ET');
select is(pg_temp.names('{"statuses": ["prospect"], "fields": [{"key": "objectif", "op": "is_empty"}]}'), 'Zoé', 'combiné aux filtres existants');
select is(pg_temp.names('{"fields": "objectif"}'), 'Alice,Bruno,Zoé', 'fields qui n''est pas un tableau : ignoré');

-- ---------------------------------------------------------------------------
-- search_members : fields et p_filters
-- ---------------------------------------------------------------------------
select is((select fields from public.search_members('fa000001-0000-0000-0000-000000000000') where first_name = 'Alice'),
  '{"poids": 72.5, "niveau": ["debutant", "confirme"], "objectif": "competition", "newsletter": true, "f_2e_contact": "Élodie Mère", "certificat_medical": "2026-03-15"}'::jsonb,
  'recherche : valeurs par clé');
select is((select fields from public.search_members('fa000001-0000-0000-0000-000000000000') where first_name = 'Zoé'),
  '{}'::jsonb, 'recherche : {} sans valeur');
select is((select array_agg(first_name || ':' || total_count) from public.search_members('fa000001-0000-0000-0000-000000000000',
  p_filters => '{"fields": [{"key": "objectif", "op": "is", "value": "competition"}]}')),
  array['Alice:1'], 'recherche filtrée par p_filters (appel nommé)');
select is((select count(*) from public.search_members('fa000001-0000-0000-0000-000000000000', null, null, 20, 0, null, 'name', null)),
  3::bigint, 'p_filters nul : aucun filtre');
select is((select count(*) from pg_proc where proname = 'search_members' and pronamespace = 'public'::regnamespace), 1::bigint,
  'une seule signature de search_members');
select is((select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'search_members' and pronamespace = 'public'::regnamespace),
  'p_gym_id uuid, p_query text, p_statuses member_status[], p_limit integer, p_offset integer, p_tag text, p_sort text, p_filters jsonb',
  'p_filters en dernière position');
select pg_temp.login_as('f0000001-0000-0000-0000-000000000005');
select is((select fields from public.search_members('fa000001-0000-0000-0000-000000000000')), '{}'::jsonb,
  'adhérent connecté : aucune valeur dans la recherche');

-- ---------------------------------------------------------------------------
-- Usage des champs
-- ---------------------------------------------------------------------------
select pg_temp.login_as('f0000001-0000-0000-0000-000000000001');
select is((select values_count || ':' || option_counts::text from public.member_field_usage('fa000001-0000-0000-0000-000000000000') where field_id = pg_temp.fid('objectif')),
  '2:{"competition": 1, "perte_de_poids": 1}', 'usage : liste simple');
select is((select option_counts from public.member_field_usage('fa000001-0000-0000-0000-000000000000') where field_id = pg_temp.fid('niveau')),
  '{"confirme": 2, "debutant": 1}'::jsonb, 'usage : liste multiple, par élément');
select is((select values_count || ':' || option_counts::text from public.member_field_usage('fa000001-0000-0000-0000-000000000000') where field_id = pg_temp.fid('poids')),
  '2:{}', 'usage : pas de répartition hors liste');
select pg_temp.login_as('f0000001-0000-0000-0000-000000000002');
select lives_ok($$select * from public.member_field_usage('fa000001-0000-0000-0000-000000000000')$$, 'accueil : lit l''usage');
select pg_temp.login_as('f0000001-0000-0000-0000-000000000003');
select throws_ok($$select * from public.member_field_usage('fa000001-0000-0000-0000-000000000000')$$,
  'P0001', 'forbidden', 'coach : pas d''usage');

-- ---------------------------------------------------------------------------
-- Option retirée : valeurs effacées ; champ supprimé : valeurs supprimées ; ordre
-- ---------------------------------------------------------------------------
select pg_temp.login_as('f0000001-0000-0000-0000-000000000001');
select lives_ok($$select public.update_member_field(pg_temp.fid('objectif'), '{"options": [
  {"value": "perte_de_poids", "label": "Perte de poids", "tone": "brand"},
  {"value": "forme", "label": "Forme", "tone": "neutral"}]}')$$, 'option « competition » retirée');
select is((select string_agg(m.first_name || '=' || (v.value #>> '{}'), ',' order by m.first_name)
           from public.member_field_values v join public.members m on m.id = v.member_id where v.field_id = pg_temp.fid('objectif')),
  'Bruno=perte_de_poids', 'liste simple : la valeur retirée est effacée, l''autre reste');
select lives_ok($$select public.update_member_field(pg_temp.fid('niveau'), '{"options": [
  {"value": "debutant", "label": "Débutant", "tone": "neutral"}]}')$$, 'option « confirme » retirée');
select is((select string_agg(m.first_name || '=' || v.value::text, ',' order by m.first_name)
           from public.member_field_values v join public.members m on m.id = v.member_id where v.field_id = pg_temp.fid('niveau')),
  'Alice=["debutant"]', 'liste multiple : élément retiré, ligne vide supprimée');
select is((select (details -> 'removed_options') from public.audit_log where action = 'member_field.update' and entity_id = pg_temp.fid('niveau')::text),
  '["confirme"]'::jsonb, 'retrait journalisé');

select pg_temp.login_as('f0000001-0000-0000-0000-000000000002');
select throws_ok($$select public.delete_member_field(pg_temp.fid('niveau'))$$, 'P0001', 'forbidden', 'accueil : ne supprime pas un champ');
select pg_temp.login_as('f0000001-0000-0000-0000-000000000001');
select throws_ok($$select public.delete_member_field('f9000001-0000-0000-0000-000000000000')$$, 'P0001', 'field_not_found', 'suppression : champ inconnu');
select lives_ok($$select public.delete_member_field(pg_temp.fid('niveau'))$$, 'gérant : supprime un champ');
select is((select count(*) from public.member_fields where key = 'niveau'), 0::bigint, 'champ supprimé');
select is((select count(*) from public.member_field_values where member_id = 'f1000001-0000-0000-0000-000000000001'),
  4::bigint, 'ses valeurs ont disparu (Alice garde ses 4 autres valeurs)');
select is((select count(*) from public.audit_log where gym_id = 'fa000001-0000-0000-0000-000000000000' and action = 'member_field.delete'),
  23::bigint, 'suppressions journalisées');

select lives_ok($$select public.reorder_member_fields('fa000001-0000-0000-0000-000000000000',
  array[pg_temp.fid('poids'), pg_temp.fid('objectif'), 'f9000001-0000-0000-0000-000000000000', pg_temp.fid('f_2e_contact')]::uuid[])$$,
  'gérant : réordonne');
select is((select array_agg(key order by position, key) from public.member_fields where key in ('poids', 'objectif', 'f_2e_contact')),
  array['poids', 'objectif', 'f_2e_contact'], 'ordre enregistré, identifiant étranger ignoré');
select pg_temp.login_as('f0000001-0000-0000-0000-000000000002');
select throws_ok($$select public.reorder_member_fields('fa000001-0000-0000-0000-000000000000', array[pg_temp.fid('poids')]::uuid[])$$,
  'P0001', 'forbidden', 'accueil : ne réordonne pas');

select pg_temp.logout();
select * from finish();
rollback;
