-- Liste d'attente de la landing : aucun accès client, inscription par join_waitlist (service_role),
-- email en minuscules, doublon sans effet, consentement exigé, limite de débit par clé.
begin;
select plan(16);

insert into auth.users (id, email) values
  ('91000000-0000-0000-0000-000000000001', 'wl-membre@test.local');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Accès client fermé
set local role anon;
select throws_ok($$select * from public.waitlist$$, '42501', null, 'anon ne lit pas la liste');
select throws_ok($$insert into public.waitlist (email, consent_text, placement) values ('x@test.local', 'ok', 'hero')$$,
  '42501', null, 'anon n''insère pas dans la liste');
select throws_ok($$select public.join_waitlist('x@test.local', true, 'ok', 'hero')$$,
  '42501', null, 'anon n''appelle pas join_waitlist');
reset role;
select pg_temp.login_as('91000000-0000-0000-0000-000000000001');
select throws_ok($$select * from public.waitlist$$, '42501', null, 'un compte connecté ne lit pas la liste');
select throws_ok($$select public.join_waitlist('x@test.local', true, 'ok', 'hero')$$,
  '42501', null, 'un compte connecté n''appelle pas join_waitlist');
reset role;

-- Inscription (Server Action, clé service_role)
set local role service_role;
select is(public.join_waitlist('  Gerant@Salle-Test.FR ', true, 'J''accepte', 'hero', 'linkedin', 'social', 'lancement', 'k1') ->> 'status',
  'joined', 'nouvelle inscription');
select is((select email || '|' || source || '|' || utm_medium || '|' || utm_campaign || '|' || placement
           from public.waitlist where email = 'gerant@salle-test.fr'),
  'gerant@salle-test.fr|linkedin|social|lancement|hero', 'email en minuscules, UTM et formulaire enregistrés');
select is(public.join_waitlist('GERANT@salle-test.fr', true, 'J''accepte', 'final', null, null, null, 'k1') ->> 'status',
  'already_joined', 'même adresse, autre casse : déjà inscrit');
select is((select count(*)::integer from public.waitlist where email = 'gerant@salle-test.fr'), 1,
  'un doublon n''ajoute pas de ligne');
select is(public.join_waitlist('direct@salle-test.fr', true, 'J''accepte', 'final', '', null, null, 'k2') ->> 'status',
  'joined', 'sans UTM');
select is((select source from public.waitlist where email = 'direct@salle-test.fr'), 'direct',
  'source « direct » par défaut');

-- Refus
select throws_ok($$select public.join_waitlist('sans-case@salle-test.fr', false, 'J''accepte', 'hero')$$,
  'P0001', 'invalid_input', 'consentement exigé');
select throws_ok($$select public.join_waitlist('pas-un-email', true, 'J''accepte', 'hero')$$,
  'P0001', 'invalid_input', 'adresse invalide refusée');

-- Limite de débit : 5 tentatives par heure et par clé (k1 en a déjà 2)
do $$
begin
  perform public.join_waitlist('a' || i || '@salle-test.fr', true, 'J''accepte', 'hero', null, null, null, 'k1')
  from generate_series(3, 5) as i;
end;
$$;
select throws_ok($$select public.join_waitlist('a6@salle-test.fr', true, 'J''accepte', 'hero', null, null, null, 'k1')$$,
  'P0001', 'rate_limited', '6e tentative de l''heure refusée');
select is(public.join_waitlist('a6@salle-test.fr', true, 'J''accepte', 'hero', null, null, null, 'k3') ->> 'status',
  'joined', 'une autre clé n''est pas limitée');
reset role;

-- Les tentatives de plus d'une heure sont effacées
insert into private.waitlist_attempts (client_key, attempted_at)
select 'k-old', now() - interval '2 hours' from generate_series(1, 5);
set local role service_role;
select is(public.join_waitlist('ancien@salle-test.fr', true, 'J''accepte', 'hero', null, null, null, 'k-old') ->> 'status',
  'joined', 'tentatives anciennes oubliées');
reset role;

select * from finish();
rollback;
