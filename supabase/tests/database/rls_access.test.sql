-- Cloisonnement des données par rôle et par salle (BRIEF §4).
-- Les comptages de données publiques sont restreints aux deux salles de test,
-- pour ne pas dépendre du seed.
-- Salle A : adhérents m1, m2 et un prospect sans compte ; coachs c1, c2 ;
-- accueil, gérant, admin. Salle B : adhérent m3 et son gérant.
begin;
select plan(48);

-- ---------------------------------------------------------------------------
-- Données de test (en tant que postgres : la RLS ne s'applique pas)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'm1@test.local'),
  ('00000000-0000-0000-0000-000000000002', 'm2@test.local'),
  ('00000000-0000-0000-0000-000000000003', 'm3@test.local'),
  ('00000000-0000-0000-0000-000000000004', 'coach1@test.local'),
  ('00000000-0000-0000-0000-000000000005', 'coach2@test.local'),
  ('00000000-0000-0000-0000-000000000006', 'staff@test.local'),
  ('00000000-0000-0000-0000-000000000007', 'manager@test.local'),
  ('00000000-0000-0000-0000-000000000008', 'admin@test.local'),
  ('00000000-0000-0000-0000-000000000009', 'managerb@test.local');

insert into public.gyms (id, name, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Salle A', 'salle-a'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Salle B', 'salle-b');

insert into public.gym_roles (gym_id, profile_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'member'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'member'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'member'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'coach'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000005', 'coach'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000006', 'staff'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000007', 'manager'),
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000008', 'admin'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000009', 'manager');

insert into public.members (id, gym_id, profile_id, first_name, last_name, status) values
  ('a0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'Marie', 'Un', 'active'),
  ('a0000000-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'Paul', 'Deux', 'active'),
  ('a0000000-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000000', null, 'Léa', 'Prospect', 'prospect'),
  ('b0000000-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'Hugo', 'Trois', 'active');

insert into public.disciplines (id, gym_id, name, color) values
  ('a1000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'CrossFit', '#dc2626'),
  ('b1000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 'Hyrox', '#f59e0b');

insert into public.coaches (id, gym_id, profile_id, display_name) values
  ('a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'Coach Un'),
  ('a2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000005', 'Coach Deux');

insert into public.coach_compensations (coach_id, gym_id, employment_type, hourly_rate_cents) values
  ('a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'employee', 2500),
  ('a2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'freelance', 4000);

insert into public.class_sessions (id, gym_id, discipline_id, coach_id, starts_at, ends_at, capacity) values
  ('a3000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', now() + interval '1 day', now() + interval '1 day 1 hour', 12),
  ('a3000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000002', now() + interval '2 days', now() + interval '2 days 1 hour', 12),
  ('b3000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-000000000000', null, now() + interval '1 day', now() + interval '1 day 1 hour', 20);

insert into public.bookings (id, gym_id, session_id, member_id, status) values
  ('a4000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'confirmed'),
  ('a4000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000b', 'confirmed'),
  ('b4000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'b3000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000a', 'confirmed');

insert into public.plans (id, gym_id, name, type, price_cents, billing_interval, is_active) values
  ('a5000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'Illimité', 'recurring', 9900, 'month', true),
  ('a5000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'Ancienne offre', 'recurring', 7900, 'month', false),
  ('b5000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'Illimité B', 'recurring', 8900, 'month', true);

insert into public.subscriptions (gym_id, member_id, plan_id, status) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'a5000000-0000-0000-0000-000000000001', 'active'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000a', 'b5000000-0000-0000-0000-000000000001', 'active');

insert into public.payments (gym_id, member_id, amount_cents, status, method) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 9900, 'succeeded', 'card'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000b', 9900, 'failed', 'sepa_debit'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000a', 8900, 'succeeded', 'card');

insert into public.credit_ledger (gym_id, member_id, delta, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 10, 'purchase'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000b', 5, 'purchase');

insert into public.interactions (gym_id, member_id, channel, direction, summary) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000c', 'email', 'inbound', 'Demande de séance d''essai');

-- Se connecter en tant qu'utilisateur : rôle authenticated + claims JWT.
create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- ---------------------------------------------------------------------------
-- Adhérent m1 (salle A) : uniquement ses données + planning public
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');

select is((select count(*) from public.members), 1::bigint, 'adhérent : voit sa seule fiche');
select is((select count(*) from public.profiles), 1::bigint, 'adhérent : voit son seul profil');
select is((select count(*) from public.bookings), 1::bigint, 'adhérent : voit ses seules réservations');
select is((select count(*) from public.payments), 1::bigint, 'adhérent : voit ses seuls paiements');
select is((select count(*) from public.subscriptions), 1::bigint, 'adhérent : voit son seul abonnement');
select is((select count(*) from public.credit_ledger), 1::bigint, 'adhérent : voit ses seuls crédits');
select is((select count(*) from public.gym_roles), 1::bigint, 'adhérent : voit ses seuls rôles');
select is((select count(*) from public.class_sessions where gym_id in ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000')), 3::bigint, 'adhérent : voit le planning public');
select is((select count(*) from public.plans where gym_id in ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000')), 2::bigint, 'adhérent : voit les offres actives uniquement');
select is((select count(*) from public.coach_compensations), 0::bigint, 'adhérent : ne voit pas la rémunération des coachs');
select is((select count(*) from public.interactions), 0::bigint, 'adhérent : ne voit pas le CRM');
select throws_ok(
  $$insert into public.bookings (gym_id, session_id, member_id, status) values
    ('aaaaaaaa-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'confirmed')$$,
  '42501', null, 'adhérent : ne peut pas réserver par INSERT direct'
);
select is_empty(
  $$update public.members set first_name = 'X' where id = 'a0000000-0000-0000-0000-00000000000b' returning id$$,
  'adhérent : ne peut pas modifier la fiche d''un autre'
);
select throws_ok(
  $$select * from public.stripe_events$$, '42501', null, 'adhérent : aucun accès à stripe_events'
);

-- ---------------------------------------------------------------------------
-- Adhérent m3 (salle B) : rien de la salle A
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-0000-0000-000000000003');

select results_eq(
  $$select id from public.members$$,
  $$values ('b0000000-0000-0000-0000-00000000000a'::uuid)$$,
  'adhérent salle B : voit sa seule fiche'
);
select is((select count(*) from public.payments), 1::bigint, 'adhérent salle B : voit ses seuls paiements');

-- ---------------------------------------------------------------------------
-- Coach c1 : ses séances, les inscrits de ses cours, pas de finances
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-0000-0000-000000000004');

select results_eq(
  $$select id from public.bookings$$,
  $$values ('a4000000-0000-0000-0000-000000000001'::uuid)$$,
  'coach : voit les seules réservations de ses séances'
);
select results_eq(
  $$select id from public.members$$,
  $$values ('a0000000-0000-0000-0000-00000000000a'::uuid)$$,
  'coach : voit les seuls adhérents inscrits à ses cours'
);
select is((select count(*) from public.payments), 0::bigint, 'coach : ne voit pas les paiements');
select is((select count(*) from public.subscriptions), 0::bigint, 'coach : ne voit pas les abonnements');
select is((select count(*) from public.credit_ledger), 0::bigint, 'coach : ne voit pas les crédits');
select results_eq(
  $$select coach_id from public.coach_compensations$$,
  $$values ('a2000000-0000-0000-0000-000000000001'::uuid)$$,
  'coach : voit sa seule rémunération'
);
select isnt_empty(
  $$update public.bookings set status = 'attended' where id = 'a4000000-0000-0000-0000-000000000001' returning id$$,
  'coach : pointe une présence dans sa séance'
);
select is_empty(
  $$update public.bookings set status = 'attended' where id = 'a4000000-0000-0000-0000-000000000002' returning id$$,
  'coach : ne pointe pas dans la séance d''un autre coach'
);
select is_empty(
  $$update public.members set first_name = 'X' where id = 'a0000000-0000-0000-0000-00000000000a' returning id$$,
  'coach : lecture seule sur les fiches adhérents'
);

-- ---------------------------------------------------------------------------
-- Accueil (staff) : réservations et fiches de sa salle, pas de finances
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-0000-0000-000000000006');

select is((select count(*) from public.members), 3::bigint, 'accueil : voit les fiches de sa salle, prospects compris');
select is((select count(*) from public.bookings), 2::bigint, 'accueil : voit les réservations de sa salle');
select is((select count(*) from public.profiles), 7::bigint, 'accueil : voit les profils de sa salle uniquement');
select is((select count(*) from public.payments), 0::bigint, 'accueil : ne voit pas les paiements');
select is((select count(*) from public.subscriptions), 0::bigint, 'accueil : ne voit pas les abonnements');
select is((select count(*) from public.credit_ledger), 0::bigint, 'accueil : ne voit pas les crédits');
select is((select count(*) from public.coach_compensations), 0::bigint, 'accueil : ne voit pas la rémunération des coachs');
select is((select count(*) from public.interactions), 0::bigint, 'accueil : ne voit pas le CRM');
select lives_ok(
  $$insert into public.members (gym_id, first_name, last_name) values
    ('aaaaaaaa-0000-0000-0000-000000000000', 'Nouveau', 'Prospect')$$,
  'accueil : crée une fiche dans sa salle'
);
select throws_ok(
  $$insert into public.members (gym_id, first_name, last_name) values
    ('bbbbbbbb-0000-0000-0000-000000000000', 'Intrus', 'Ailleurs')$$,
  '42501', null, 'accueil : ne crée pas de fiche dans une autre salle'
);
select throws_ok(
  $$insert into public.gym_roles (gym_id, profile_id, role) values
    ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000006', 'manager')$$,
  '42501', null, 'accueil : ne s''attribue pas de rôle'
);

-- ---------------------------------------------------------------------------
-- Gérant salle A : tout sur sa salle, rien sur la salle B
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-0000-0000-000000000007');

select is((select count(*) from public.payments), 2::bigint, 'gérant : voit les paiements de sa salle uniquement');
select is((select count(*) from public.subscriptions), 1::bigint, 'gérant : voit les abonnements de sa salle uniquement');
select is((select count(*) from public.credit_ledger), 2::bigint, 'gérant : voit les crédits de sa salle');
select is((select count(*) from public.coach_compensations), 2::bigint, 'gérant : voit la rémunération des coachs');
select is((select count(*) from public.interactions), 1::bigint, 'gérant : voit le CRM de sa salle');
select is((select count(*) from public.plans where gym_id in ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000')), 3::bigint, 'gérant : voit ses offres inactives en plus des offres publiques');
select is_empty(
  $$update public.gyms set name = 'Piratée' where id = 'bbbbbbbb-0000-0000-0000-000000000000' returning id$$,
  'gérant : ne modifie pas une autre salle'
);
select lives_ok(
  $$insert into public.gym_roles (gym_id, profile_id, role) values
    ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000006', 'coach')$$,
  'gérant : attribue un rôle d''équipe'
);
select throws_ok(
  $$insert into public.gym_roles (gym_id, profile_id, role) values
    ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000007', 'admin')$$,
  '42501', null, 'gérant : ne s''attribue pas le rôle admin'
);

-- ---------------------------------------------------------------------------
-- Admin salle A : peut attribuer le rôle admin
-- ---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-0000-0000-000000000008');

select lives_ok(
  $$insert into public.gym_roles (gym_id, profile_id, role) values
    ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000007', 'admin')$$,
  'admin : attribue le rôle admin'
);

-- ---------------------------------------------------------------------------
-- Visiteur non connecté (anon) : planning et offres publics seulement
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;

select is((select count(*) from public.class_sessions where gym_id in ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000')), 3::bigint, 'anon : voit le planning public');
select throws_ok(
  $$select * from public.members$$, '42501', null, 'anon : aucun accès aux fiches adhérents'
);

select * from finish();
rollback;
