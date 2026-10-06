-- Suggestions d'étiquettes : fréquence, filtre, isolement par salle, refus hors de l'accueil.
begin;
select plan(6);

insert into auth.users (id, email) values
  ('e0000002-0000-0000-0000-000000000001', 't-accueil@test.local'),
  ('e0000002-0000-0000-0000-000000000002', 't-coach@test.local'),
  ('e0000002-0000-0000-0000-000000000003', 't-autre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('ea000002-0000-0000-0000-000000000001', 'Salle T', 'salle-t-tags', 'Europe/Paris'),
  ('ea000002-0000-0000-0000-000000000002', 'Salle U', 'salle-u-tags', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('ea000002-0000-0000-0000-000000000001', 'e0000002-0000-0000-0000-000000000001', 'staff'),
  ('ea000002-0000-0000-0000-000000000001', 'e0000002-0000-0000-0000-000000000002', 'coach'),
  ('ea000002-0000-0000-0000-000000000002', 'e0000002-0000-0000-0000-000000000003', 'staff');
insert into public.members (gym_id, first_name, last_name, status, tags) values
  ('ea000002-0000-0000-0000-000000000001', 'A', 'A', 'active', '{hyrox,course à pied}'),
  ('ea000002-0000-0000-0000-000000000001', 'B', 'B', 'active', '{hyrox}'),
  ('ea000002-0000-0000-0000-000000000001', 'C', 'C', 'prospect', '{essai,parrainage,étudiant}'),
  ('ea000002-0000-0000-0000-000000000002', 'D', 'D', 'active', '{secret}');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login_as('e0000002-0000-0000-0000-000000000001');
select is((select tag from public.tag_suggestions('ea000002-0000-0000-0000-000000000001') limit 1),
  'hyrox', 'la plus fréquente en premier');
select is((select array_agg(tag order by tag) from public.tag_suggestions('ea000002-0000-0000-0000-000000000001', 'pa')),
  array['parrainage'], 'filtre sur le texte');
select is((select array_agg(tag) from public.tag_suggestions('ea000002-0000-0000-0000-000000000001', 'ETU')),
  array['étudiant'], 'sans accents ni casse');
select is((select count(*)::integer from public.tag_suggestions('ea000002-0000-0000-0000-000000000001') where tag = 'secret'),
  0, 'aucune étiquette d''une autre salle');
select pg_temp.login_as('e0000002-0000-0000-0000-000000000002');
select throws_ok($$select * from public.tag_suggestions('ea000002-0000-0000-0000-000000000001')$$,
  'P0001', 'forbidden', 'coach : refusé');
select pg_temp.login_as('e0000002-0000-0000-0000-000000000003');
select throws_ok($$select * from public.tag_suggestions('ea000002-0000-0000-0000-000000000001')$$,
  'P0001', 'forbidden', 'autre salle : refusé');

select * from finish();
rollback;
