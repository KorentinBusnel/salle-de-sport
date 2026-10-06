-- Marketplace, paiements : contexte de paiement (gérant), webhook (commande payée, idempotence,
-- échec), achats groupés (engagement, carte enregistrée, clôture au palier atteint, minimum non
-- atteint, débit refusé), cloisonnement entre salles.
begin;
select plan(27);

insert into auth.users (id, email) values
  ('c1100000-0000-0000-0000-000000000001', 'mpp-admin@test.local'),
  ('c1100000-0000-0000-0000-000000000002', 'mpp-gerant-a@test.local'),
  ('c1100000-0000-0000-0000-000000000003', 'mpp-gerant-b@test.local'),
  ('c1100000-0000-0000-0000-000000000004', 'mpp-accueil@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('c1a00000-0000-0000-0000-000000000000', 'Salle PA', 'salle-mppa', 'Europe/Paris'),
  ('c1b00000-0000-0000-0000-000000000000', 'Salle PB', 'salle-mppb', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('c1a00000-0000-0000-0000-000000000000', 'c1100000-0000-0000-0000-000000000001', 'admin'),
  ('c1a00000-0000-0000-0000-000000000000', 'c1100000-0000-0000-0000-000000000002', 'manager'),
  ('c1b00000-0000-0000-0000-000000000000', 'c1100000-0000-0000-0000-000000000003', 'manager'),
  ('c1a00000-0000-0000-0000-000000000000', 'c1100000-0000-0000-0000-000000000004', 'staff');
insert into public.gym_billing (gym_id, stripe_customer_id) values
  ('c1a00000-0000-0000-0000-000000000000', 'cus_pa'),
  ('c1b00000-0000-0000-0000-000000000000', 'cus_pb');
insert into public.mp_products (id, kind, name, unit, list_price_cents, price_cents, is_active) values
  ('c1400000-0000-0000-0000-000000000001', 'product', 'Whey test', 'pot', 4000, 3000, true);
insert into public.mp_price_tiers (product_id, min_qty, unit_price_cents) values
  ('c1400000-0000-0000-0000-000000000001', 20, 2600),
  ('c1400000-0000-0000-0000-000000000001', 50, 2200);

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Paiement d'une commande
select pg_temp.login_as('c1100000-0000-0000-0000-000000000002');
select lives_ok($$select public.mp_set_cart_item('c1a00000-0000-0000-0000-000000000000', 'c1400000-0000-0000-0000-000000000001', 2)$$, 'panier');
create temp table t_order as select * from public.mp_checkout_cart('c1a00000-0000-0000-0000-000000000000');
grant select on t_order to authenticated;
select is((public.mp_payment_context((select id from t_order)) ->> 'customer_id'), 'cus_pa', 'contexte : client Stripe de la salle');
select is((public.mp_payment_context((select id from t_order)) #>> '{order,total_cents}')::integer, 6000, 'contexte : total de la commande');
select pg_temp.login_as('c1100000-0000-0000-0000-000000000003');
select throws_ok($$select public.mp_payment_context((select id from t_order))$$, 'P0001', 'forbidden', 'autre salle : pas de paiement');
select pg_temp.login_as('c1100000-0000-0000-0000-000000000004');
select is((select count(*)::integer from public.gym_billing), 0, 'accueil : client Stripe caché');
reset role;

select is(public.apply_stripe_event(jsonb_build_object('id', 'evt_mp1', 'type', 'payment_intent.payment_failed',
  'data', jsonb_build_object('object', jsonb_build_object('id', 'pi_mp1', 'amount', 6000, 'currency', 'eur',
    'metadata', jsonb_build_object('kind', 'marketplace', 'order_id', (select id from t_order)))))), 'marketplace', 'échec traité');
select is((select status::text from public.mp_orders where id = (select id from t_order)), 'pending_payment', 'échec : commande toujours à payer');
select is(public.apply_stripe_event(jsonb_build_object('id', 'evt_mp2', 'type', 'payment_intent.succeeded',
  'data', jsonb_build_object('object', jsonb_build_object('id', 'pi_mp2', 'amount', 6000, 'currency', 'eur',
    'metadata', jsonb_build_object('kind', 'marketplace', 'order_id', (select id from t_order))))), 'sepa_debit'), 'marketplace', 'paiement traité');
select is((select status::text from public.mp_orders where id = (select id from t_order)), 'paid', 'commande payée');
select is((select method::text from public.mp_payments where stripe_payment_intent_id = 'pi_mp2'), 'sepa_debit', 'paiement enregistré avec son moyen');
select is(public.apply_stripe_event(jsonb_build_object('id', 'evt_mp2', 'type', 'payment_intent.succeeded',
  'data', jsonb_build_object('object', jsonb_build_object('id', 'pi_mp2', 'metadata', jsonb_build_object('kind', 'marketplace'))))), 'duplicate', 'événement rejoué : ignoré');
select is(public.apply_stripe_event('{"id":"evt_mp3","type":"payment_intent.succeeded","data":{"object":{"id":"pi_x","metadata":{"kind":"pack"}}}}'),
  'ignored', 'paiement adhérent : traitement habituel');
select pg_temp.login_as('c1100000-0000-0000-0000-000000000002');
select throws_ok($$select public.mp_payment_context((select id from t_order))$$, 'P0001', 'mp_invalid_status', 'commande payée : plus de paiement');

-- Achat groupé : minimum non atteint
select pg_temp.login_as('c1100000-0000-0000-0000-000000000002');
select throws_ok($$select public.mp_create_campaign('c1400000-0000-0000-0000-000000000001', now() + interval '7 days')$$,
  'P0001', 'forbidden', 'gérant : pas de campagne');
select pg_temp.login_as('c1100000-0000-0000-0000-000000000001');
create temp table t_small as select * from public.mp_create_campaign('c1400000-0000-0000-0000-000000000001', now() + interval '7 days', 100, 'Petite');
create temp table t_big as select * from public.mp_create_campaign('c1400000-0000-0000-0000-000000000001', now() + interval '7 days', 10, null);
grant select on t_small, t_big to authenticated;
select is((select title from t_big), 'Whey test', 'titre repris du produit');
select pg_temp.login_as('c1100000-0000-0000-0000-000000000002');
select is((public.mp_commit((select id from t_small), 'c1a00000-0000-0000-0000-000000000000', 5)) #>> '{commitment,status}', 'pending_card', 'engagement : carte à enregistrer');
reset role;
select is(public.apply_stripe_event(jsonb_build_object('id', 'evt_si1', 'type', 'setup_intent.succeeded',
  'data', jsonb_build_object('object', jsonb_build_object('id', 'seti_1', 'payment_method', 'pm_a',
    'metadata', jsonb_build_object('kind', 'mp_commitment', 'commitment_id',
      (select id from public.mp_commitments where campaign_id = (select id from t_small))))))), 'mp_commitment', 'carte enregistrée');
select pg_temp.login_as('c1100000-0000-0000-0000-000000000001');
select is((public.mp_close_campaign((select id from t_small))) ->> 'status', 'cancelled', 'minimum non atteint : annulée, rien à débiter');

-- Achat groupé : deux salles, palier atteint par le total
select pg_temp.login_as('c1100000-0000-0000-0000-000000000002');
select lives_ok($$select public.mp_commit((select id from t_big), 'c1a00000-0000-0000-0000-000000000000', 12)$$, 'salle A s''engage');
select pg_temp.login_as('c1100000-0000-0000-0000-000000000003');
select lives_ok($$select public.mp_commit((select id from t_big), 'c1b00000-0000-0000-0000-000000000000', 10)$$, 'salle B s''engage');
select is((select count(*)::integer from public.mp_commitments where campaign_id = (select id from t_big)), 1, 'salle B ne voit que son engagement');
reset role;
update public.mp_commitments set status = 'committed', stripe_payment_method_id = 'pm_' || left(gym_id::text, 3)
where campaign_id = (select id from t_big);
select pg_temp.login_as('c1100000-0000-0000-0000-000000000003');
select is((select total_qty || '/' || unit_price_cents || '/' || next_min_qty from public.mp_campaign_progress('c1b00000-0000-0000-0000-000000000000') where id = (select id from t_big)),
  '22/2600/50', 'progression : 22 engagés, palier 20, prochain à 50');
select pg_temp.login_as('c1100000-0000-0000-0000-000000000001');
create temp table t_close as select public.mp_close_campaign((select id from t_big)) as r;
select is((select jsonb_array_length(r -> 'charges') from t_close), 2, 'clôture : deux débits');
select is((select (r -> 'charges' -> 0 ->> 'amount_cents')::integer from t_close), 12 * 2600, 'salle A : 12 × prix du palier 20');
reset role;
-- Débit refusé pour la salle B : commande « à payer », engagement en échec.
select is(public.apply_stripe_event(jsonb_build_object('id', 'evt_mp4', 'type', 'payment_intent.payment_failed',
  'data', jsonb_build_object('object', jsonb_build_object('id', 'pi_mp4', 'amount', 26000,
    'metadata', jsonb_build_object('kind', 'marketplace', 'order_id',
      (select r -> 'charges' -> 1 ->> 'order_id' from t_close)))))), 'marketplace', 'débit refusé traité');
select is((select status::text from public.mp_commitments where gym_id = 'c1b00000-0000-0000-0000-000000000000' and campaign_id = (select id from t_big)),
  'failed', 'engagement en échec, commande à payer par Checkout');
select pg_temp.login_as('c1100000-0000-0000-0000-000000000002');
select throws_ok($$select public.mp_commit((select id from t_big), 'c1a00000-0000-0000-0000-000000000000', 3)$$,
  'P0001', 'mp_campaign_closed', 'campagne close : plus d''engagement');
reset role;

select * from finish();
rollback;
