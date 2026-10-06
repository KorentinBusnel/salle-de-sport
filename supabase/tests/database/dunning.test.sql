-- Impayés et relances : droits (accueil et gérant), carnet échoué exclu, relance manuelle
-- dédupliquée, relances automatiques J+3 / J+7, réglage à 0, encaissement sur place.
begin;
select plan(20);

insert into auth.users (id, email) values
  ('a1100000-0000-0000-0000-000000000001', 'du-gerant@test.local'),
  ('a1100000-0000-0000-0000-000000000002', 'du-accueil@test.local'),
  ('a1100000-0000-0000-0000-000000000003', 'du-coach@test.local'),
  ('a1100000-0000-0000-0000-000000000004', 'du-membre@test.local'),
  ('a1100000-0000-0000-0000-000000000005', 'du-autre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('a1a00000-0000-0000-0000-000000000000', 'Salle DU', 'salle-du', 'Europe/Paris'),
  ('a1b00000-0000-0000-0000-000000000000', 'Salle DV', 'salle-dv', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('a1a00000-0000-0000-0000-000000000000', 'a1100000-0000-0000-0000-000000000001', 'manager'),
  ('a1a00000-0000-0000-0000-000000000000', 'a1100000-0000-0000-0000-000000000002', 'staff'),
  ('a1a00000-0000-0000-0000-000000000000', 'a1100000-0000-0000-0000-000000000003', 'coach'),
  ('a1a00000-0000-0000-0000-000000000000', 'a1100000-0000-0000-0000-000000000004', 'member'),
  ('a1b00000-0000-0000-0000-000000000000', 'a1100000-0000-0000-0000-000000000005', 'manager');
insert into public.members (id, gym_id, profile_id, first_name, last_name, email, status) values
  -- Manuel : période finie, passé en impayé il y a 4 jours.
  ('a1200000-0000-0000-0000-000000000001', 'a1a00000-0000-0000-0000-000000000000', 'a1100000-0000-0000-0000-000000000004', 'Mia', 'Manuel', 'mia@test.local', 'active'),
  -- En ligne : facture Stripe échouée il y a 8 jours.
  ('a1200000-0000-0000-0000-000000000002', 'a1a00000-0000-0000-0000-000000000000', null, 'Oscar', 'Online', 'oscar@test.local', 'active'),
  -- Carnet payé en ligne qui a échoué : pas un impayé.
  ('a1200000-0000-0000-0000-000000000003', 'a1a00000-0000-0000-0000-000000000000', null, 'Paul', 'Pack', 'paul@test.local', 'active');
insert into public.plans (id, gym_id, name, type, price_cents, billing_interval, credits) values
  ('a1300000-0000-0000-0000-000000000001', 'a1a00000-0000-0000-0000-000000000000', 'Illimité', 'recurring', 7900, 'month', null),
  ('a1300000-0000-0000-0000-000000000002', 'a1a00000-0000-0000-0000-000000000000', 'Carnet 10', 'pack', 18000, null, 10);
insert into public.subscriptions (id, gym_id, member_id, plan_id, status, current_period_start, current_period_end, stripe_subscription_id) values
  ('a1400000-0000-0000-0000-000000000001', 'a1a00000-0000-0000-0000-000000000000', 'a1200000-0000-0000-0000-000000000001', 'a1300000-0000-0000-0000-000000000001', 'past_due', now() - interval '34 days', now() - interval '4 days', null),
  ('a1400000-0000-0000-0000-000000000002', 'a1a00000-0000-0000-0000-000000000000', 'a1200000-0000-0000-0000-000000000002', 'a1300000-0000-0000-0000-000000000001', 'past_due', now() - interval '38 days', now() + interval '1 day', 'sub_du');
-- Date de passage en impayé (updated_at est posé par trigger : on la recale ensuite).
alter table public.subscriptions disable trigger user;
update public.subscriptions set updated_at = now() - interval '4 days' where id = 'a1400000-0000-0000-0000-000000000001';
update public.subscriptions set updated_at = now() - interval '8 days' where id = 'a1400000-0000-0000-0000-000000000002';
alter table public.subscriptions enable trigger user;
insert into public.payments (gym_id, member_id, plan_id, amount_cents, status, method, created_at, stripe_invoice_id, stripe_payment_intent_id) values
  ('a1a00000-0000-0000-0000-000000000000', 'a1200000-0000-0000-0000-000000000002', 'a1300000-0000-0000-0000-000000000001', 7900, 'failed', 'card', now() - interval '8 days', 'in_du', null),
  ('a1a00000-0000-0000-0000-000000000000', 'a1200000-0000-0000-0000-000000000003', 'a1300000-0000-0000-0000-000000000002', 18000, 'failed', 'card', now() - interval '8 days', null, 'pi_du');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Liste : accueil autorisé, carnet exclu
select pg_temp.login_as('a1100000-0000-0000-0000-000000000002');
select is((select string_agg(first_name, ',' order by first_name) from public.unpaid_members('a1a00000-0000-0000-0000-000000000000')),
  'Mia,Oscar', 'accueil : impayés visibles, carnet échoué exclu');
select is((select online::text || '/' || settleable::text from public.unpaid_members('a1a00000-0000-0000-0000-000000000000') where first_name = 'Mia'),
  'false/true', 'abonnement manuel : encaissable sur place');
select is((select online::text || '/' || settleable::text from public.unpaid_members('a1a00000-0000-0000-0000-000000000000') where first_name = 'Oscar'),
  'true/false', 'abonnement en ligne : à régulariser par l''adhérent');
select ok(public.payment_reminder_preview('a1200000-0000-0000-0000-000000000002') ->> 'body' like '%Moyen de paiement%',
  'texte en ligne : renvoie vers le moyen de paiement');
select ok(public.payment_reminder_preview('a1200000-0000-0000-0000-000000000001') ->> 'body' like '%79,00 €%',
  'texte : montant dû');

-- Droits
select pg_temp.login_as('a1100000-0000-0000-0000-000000000003');
select throws_ok($$select * from public.unpaid_members('a1a00000-0000-0000-0000-000000000000')$$, 'P0001', 'forbidden', 'coach : refusé');
select pg_temp.login_as('a1100000-0000-0000-0000-000000000004');
select throws_ok($$select public.send_payment_reminder('a1200000-0000-0000-0000-000000000001', 'x', 'y')$$, 'P0001', 'forbidden', 'adhérent : refusé');
select pg_temp.login_as('a1100000-0000-0000-0000-000000000005');
select throws_ok($$select public.settle_unpaid('a1400000-0000-0000-0000-000000000001', 'cash')$$, 'P0001', 'forbidden', 'autre salle : refusé');

-- Relance manuelle (accueil) : une par jour
select pg_temp.login_as('a1100000-0000-0000-0000-000000000002');
select isnt(public.send_payment_reminder('a1200000-0000-0000-0000-000000000001', 'Paiement en attente', 'Bonjour Mia'), null, 'relance envoyée');
select throws_ok($$select public.send_payment_reminder('a1200000-0000-0000-0000-000000000001', 'Encore', 'Bonjour')$$,
  'P0001', 'already_reminded', 'une relance par jour au plus');
select throws_ok($$select public.send_payment_reminder('a1200000-0000-0000-0000-000000000003', 'x', 'y')$$,
  'P0001', 'not_unpaid', 'pas d''impayé : refusé');
select is((select reminders from public.unpaid_members('a1a00000-0000-0000-0000-000000000000') where first_name = 'Mia'),
  1, 'relance comptée');
reset role;

-- Relances automatiques : Mia (J+4) relancée aujourd'hui à la main → sautée ; Oscar (J+8) → palier 1
select is(private.run_dunning(), 1, 'une relance automatique (Oscar), Mia déjà relancée aujourd''hui');
select is((select count(*)::integer from public.outbound_messages where member_id = 'a1200000-0000-0000-0000-000000000002' and dedupe_key like 'dunning:%:1'),
  1, 'palier J+3 envoyé');
-- Lendemain simulé : les messages déjà envoyés vieillissent d'un jour
update public.outbound_messages set created_at = created_at - interval '1 day'
where member_id in ('a1200000-0000-0000-0000-000000000001', 'a1200000-0000-0000-0000-000000000002');
select is(private.run_dunning(), 2, 'palier J+7 pour Oscar, palier J+3 pour Mia');
select is(private.run_dunning(), 0, 'chaque palier une seule fois');

-- Réglage à 0 : paliers désactivés
insert into public.gym_private_settings (gym_id, settings) values ('a1a00000-0000-0000-0000-000000000000', '{"dunning_first_days": 0, "dunning_second_days": 0}')
  on conflict (gym_id) do update set settings = excluded.settings;
delete from public.outbound_messages where dedupe_key like 'dunning:%';
select is(private.run_dunning(), 0, 'paliers à 0 : aucune relance');

-- Encaissement sur place (accueil, sans la stratégie de vente)
select pg_temp.login_as('a1100000-0000-0000-0000-000000000002');
select is((public.settle_unpaid('a1400000-0000-0000-0000-000000000001', 'cash')).status, 'active'::public.subscription_status,
  'encaissé : abonnement actif');
select throws_ok($$select public.settle_unpaid('a1400000-0000-0000-0000-000000000002', 'cash')$$,
  'P0001', 'not_settleable', 'abonnement en ligne : pas d''encaissement sur place');
select is((select count(*)::integer from public.unpaid_members('a1a00000-0000-0000-0000-000000000000') where first_name = 'Mia'),
  0, 'Mia n''est plus en impayé');
reset role;

select * from finish();
rollback;
