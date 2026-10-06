-- Miroir Stripe : événements idempotents, abonnement (accès, impayé, résiliation), carnet payé
-- en ligne, remboursement ; préparation d'un achat par l'adhérent ; droits (service_role seul).
begin;
select plan(26);

insert into auth.users (id, email) values
  ('81000000-0000-0000-0000-000000000001', 'ss-membre@test.local'),
  ('81000000-0000-0000-0000-000000000002', 'ss-autre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('8a000000-0000-0000-0000-000000000000', 'Salle SS', 'salle-ss', 'Europe/Paris'),
  ('8b000000-0000-0000-0000-000000000000', 'Salle ST', 'salle-st', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('8a000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000001', 'member'),
  ('8b000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000002', 'member');
insert into public.members (id, gym_id, profile_id, first_name, last_name, email, status, stripe_customer_id) values
  ('82000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000001', 'Ana', 'Abel', 'ana@test.local', 'prospect', 'cus_ana'),
  ('82000000-0000-0000-0000-000000000002', '8b000000-0000-0000-0000-000000000000', '81000000-0000-0000-0000-000000000002', 'Bob', 'Brun', 'bob@test.local', 'active', null);
insert into public.plans (id, gym_id, name, type, price_cents, billing_interval, commitment_months, credits, validity_days, stripe_price_id) values
  ('84000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000000', 'Illimité', 'recurring', 7900, 'month', 12, null, null, 'price_unlimited'),
  ('84000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000000', 'Carnet 10', 'pack', 18000, null, null, 10, 120, null);
insert into public.promo_codes (id, gym_id, code, kind, value) values
  ('86000000-0000-0000-0000-000000000001', '8a000000-0000-0000-0000-000000000000', 'BIENVENUE', 'amount', 2000);

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Préparation d'un achat (adhérent)
select pg_temp.login_as('81000000-0000-0000-0000-000000000001');
select is((public.billing_checkout_context('84000000-0000-0000-0000-000000000002', 'bienvenue') ->> 'final_cents')::integer,
  16000, 'achat préparé : prix après code promo');
select is(public.billing_checkout_context('84000000-0000-0000-0000-000000000001') #>> '{member,stripe_customer_id}',
  'cus_ana', 'client Stripe de l''adhérent repris');
select pg_temp.login_as('81000000-0000-0000-0000-000000000002');
select throws_ok($$select public.billing_checkout_context('84000000-0000-0000-0000-000000000001')$$,
  'P0001', 'not_a_member', 'offre d''une autre salle : refusée');
select throws_ok($$select public.apply_stripe_event('{"id":"evt_x","type":"invoice.paid","data":{"object":{}}}')$$,
  '42501', null, 'un adhérent ne peut pas injecter un événement Stripe');
reset role;

-- Abonnement créé (SEPA en cours : Stripe le dit actif)
select is(public.apply_stripe_event(jsonb_build_object(
  'id', 'evt_1', 'type', 'customer.subscription.created',
  'data', jsonb_build_object('object', jsonb_build_object(
    'id', 'sub_1', 'customer', 'cus_ana', 'status', 'active',
    'start_date', extract(epoch from now())::bigint,
    'metadata', jsonb_build_object('member_id', '82000000-0000-0000-0000-000000000001', 'plan_id', '84000000-0000-0000-0000-000000000001'),
    'items', jsonb_build_object('data', jsonb_build_array(jsonb_build_object(
      'price', jsonb_build_object('id', 'price_unlimited'),
      'current_period_start', extract(epoch from now())::bigint,
      'current_period_end', extract(epoch from now() + interval '1 month')::bigint))))))),
  'subscription', 'abonnement créé');
select is(public.apply_stripe_event(jsonb_build_object('id', 'evt_1', 'type', 'customer.subscription.created',
  'data', jsonb_build_object('object', jsonb_build_object('id', 'sub_1')))),
  'duplicate', 'un même événement n''est traité qu''une fois');
select is((select status from public.subscriptions where stripe_subscription_id = 'sub_1'),
  'active'::public.subscription_status, 'abonnement actif');
select ok((select current_period_end > now() + interval '27 days' from public.subscriptions where stripe_subscription_id = 'sub_1'),
  'période lue sur l''élément d''abonnement (API récente)');
select ok((select commitment_ends_at > now() + interval '11 months' from public.subscriptions where stripe_subscription_id = 'sub_1'),
  'fin d''engagement calculée');
select is((select status from public.members where id = '82000000-0000-0000-0000-000000000001'),
  'active'::public.member_status, 'le prospect devient actif');
select ok(private.has_active_subscription('82000000-0000-0000-0000-000000000001'), 'accès ouvert');

-- Échec de prélèvement : impayé, accès suspendu, adhérent prévenu
select is(public.apply_stripe_event('{"id":"evt_2","type":"invoice.payment_failed","data":{"object":{"id":"in_1","customer":"cus_ana","subscription":"sub_1","amount_due":7900,"currency":"eur"}}}', 'sepa_debit'),
  'invoice', 'échec de facture traité');
select is((select status from public.subscriptions where stripe_subscription_id = 'sub_1'),
  'past_due'::public.subscription_status, 'abonnement en impayé');
select ok(not private.has_active_subscription('82000000-0000-0000-0000-000000000001'), 'accès suspendu');
select is((select count(*)::integer from public.outbound_messages
           where member_id = '82000000-0000-0000-0000-000000000001' and origin = 'billing'),
  1, 'adhérent prévenu une fois');
select is((select status from public.payments where stripe_invoice_id = 'in_1'),
  'failed'::public.payment_status, 'paiement échoué enregistré');

-- Facture finalement payée : même paiement, passé à « payé »
select is(public.apply_stripe_event('{"id":"evt_3","type":"invoice.paid","data":{"object":{"id":"in_1","customer":"cus_ana","subscription":"sub_1","amount_paid":7900,"currency":"eur","payment_intent":"pi_inv1"}}}', 'sepa_debit'),
  'invoice', 'facture payée');
select is((select status::text || '/' || method::text || '/' || count(*) over () from public.payments where stripe_invoice_id = 'in_1'),
  'succeeded/sepa_debit/1', 'un seul paiement, payé, par prélèvement');

-- Carnet payé en ligne : crédits, puis remboursement
select is(public.apply_stripe_event(jsonb_build_object('id', 'evt_4', 'type', 'payment_intent.succeeded',
  'data', jsonb_build_object('object', jsonb_build_object('id', 'pi_pack', 'customer', 'cus_ana', 'amount', 16000, 'currency', 'eur',
    'metadata', jsonb_build_object('kind', 'pack', 'member_id', '82000000-0000-0000-0000-000000000001',
      'plan_id', '84000000-0000-0000-0000-000000000002', 'promo_code_id', '86000000-0000-0000-0000-000000000001'))))),
  'pack', 'carnet payé');
select is(private.credit_balance('82000000-0000-0000-0000-000000000001'), 10, '10 crédits ajoutés');
select is((select promo_code_id from public.payments where stripe_payment_intent_id = 'pi_pack'),
  '86000000-0000-0000-0000-000000000001'::uuid, 'code promo rattaché au paiement');
select is(public.apply_stripe_event('{"id":"evt_5","type":"charge.refunded","data":{"object":{"id":"ch_1","payment_intent":"pi_pack","refunded":true}}}'),
  'refund', 'remboursement traité');
select is(private.credit_balance('82000000-0000-0000-0000-000000000001'), 0, 'crédits du carnet remboursé retirés');

-- Résiliation demandée : fin à la période
select lives_ok($$select public.sync_stripe_subscription(jsonb_build_object(
  'id', 'sub_1', 'customer', 'cus_ana', 'status', 'active', 'cancel_at_period_end', true,
  'current_period_end', extract(epoch from now() + interval '20 days')::bigint,
  'metadata', jsonb_build_object('member_id', '82000000-0000-0000-0000-000000000001', 'plan_id', '84000000-0000-0000-0000-000000000001')))$$,
  'résiliation en fin de période synchronisée');

select is((public.sync_stripe_subscription('{"id":"sub_1","status":"active","cancel_at_period_end":false}')).member_id,
  '82000000-0000-0000-0000-000000000001'::uuid, 'objet sans métadonnées : adhérent et offre repris de l''abonnement connu');

-- Les Edge Functions (service_role) enregistrent le client Stripe d'un adhérent
set local role service_role;
select lives_ok($$update public.members set stripe_customer_id = 'cus_bob' where id = '82000000-0000-0000-0000-000000000002'$$,
  'service_role enregistre le client Stripe (colonne de recherche recalculée)');
reset role;

select * from finish();
rollback;
