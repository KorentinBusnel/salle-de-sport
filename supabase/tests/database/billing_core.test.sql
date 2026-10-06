-- Facturation sans Stripe : accès par discipline, lots de crédits et expiration, ventes sur
-- place, renouvellement, codes promo, droits (gérant, accueil selon la stratégie), RLS.
begin;
select plan(35);

insert into auth.users (id, email) values
  ('71000000-0000-0000-0000-000000000001', 'bc-gerant@test.local'),
  ('71000000-0000-0000-0000-000000000002', 'bc-accueil@test.local'),
  ('71000000-0000-0000-0000-000000000003', 'bc-membre@test.local'),
  ('71000000-0000-0000-0000-000000000004', 'bc-autre@test.local'),
  ('71000000-0000-0000-0000-000000000005', 'bc-membre2@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('7a000000-0000-0000-0000-000000000000', 'Salle BC', 'salle-bc', 'Europe/Paris'),
  ('7b000000-0000-0000-0000-000000000000', 'Salle BD', 'salle-bd', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('7a000000-0000-0000-0000-000000000000', '71000000-0000-0000-0000-000000000001', 'manager'),
  ('7a000000-0000-0000-0000-000000000000', '71000000-0000-0000-0000-000000000002', 'staff'),
  ('7a000000-0000-0000-0000-000000000000', '71000000-0000-0000-0000-000000000003', 'member'),
  ('7a000000-0000-0000-0000-000000000000', '71000000-0000-0000-0000-000000000005', 'member'),
  ('7b000000-0000-0000-0000-000000000000', '71000000-0000-0000-0000-000000000004', 'manager');
insert into public.members (id, gym_id, profile_id, first_name, last_name, status) values
  ('72000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000000', '71000000-0000-0000-0000-000000000003', 'Ana', 'Abel', 'active'),
  ('72000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000000', null, 'Bob', 'Brun', 'prospect'),
  ('72000000-0000-0000-0000-000000000003', '7a000000-0000-0000-0000-000000000000', '71000000-0000-0000-0000-000000000005', 'Cyd', 'Coste', 'active');
insert into public.disciplines (id, gym_id, name, color) values
  ('73000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000000', 'CrossFit', '#dc2626'),
  ('73000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000000', 'Run', '#16a34a');
insert into public.class_sessions (id, gym_id, discipline_id, starts_at, ends_at, capacity) values
  ('75000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000000', '73000000-0000-0000-0000-000000000001',
   now() + interval '1 day', now() + interval '1 day 1 hour', 10),
  ('75000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000000', '73000000-0000-0000-0000-000000000002',
   now() + interval '2 days', now() + interval '2 days 1 hour', 10),
  ('75000000-0000-0000-0000-000000000003', '7a000000-0000-0000-0000-000000000000', '73000000-0000-0000-0000-000000000001',
   now() + interval '3 days', now() + interval '3 days 1 hour', 10);
insert into public.plans (id, gym_id, name, type, price_cents, billing_interval, credits, validity_days, all_disciplines) values
  ('74000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000000', 'Run club', 'recurring', 3900, 'month', null, null, false),
  ('74000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000000', 'Carnet Run', 'pack', 5000, null, 5, 30, false),
  ('74000000-0000-0000-0000-000000000003', '7a000000-0000-0000-0000-000000000000', 'Carnet 10', 'pack', 18000, null, 10, 120, true),
  ('74000000-0000-0000-0000-000000000004', '7b000000-0000-0000-0000-000000000000', 'Ailleurs', 'pack', 1000, null, 1, null, true);
insert into public.plan_disciplines (gym_id, plan_id, discipline_id) values
  ('7a000000-0000-0000-0000-000000000000', '74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002'),
  ('7a000000-0000-0000-0000-000000000000', '74000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000002');
insert into public.promo_codes (id, gym_id, code, kind, value, max_redemptions) values
  ('76000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000000', 'MOINS20', 'percent', 20, 1),
  ('76000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000000', 'RUNONLY', 'amount', 1000, null);
insert into public.promo_code_plans (gym_id, promo_code_id, plan_id) values
  ('7a000000-0000-0000-0000-000000000000', '76000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000002');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Ventes sur place (gérant)
select pg_temp.login_as('71000000-0000-0000-0000-000000000001');
select is((select final_cents from public.price_quote('74000000-0000-0000-0000-000000000003', 'moins20')),
  14400, 'aperçu : remise de 20 %, code insensible à la casse');
select throws_ok($$select * from public.price_quote('74000000-0000-0000-0000-000000000003', 'RUNONLY')$$,
  'P0001', 'promo_invalid', 'code réservé à une autre offre');
select throws_ok($$select * from public.price_quote('74000000-0000-0000-0000-000000000003', 'INCONNU')$$,
  'P0001', 'promo_invalid', 'code inconnu');

select is((public.record_manual_sale('72000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000002', 'cash')).amount_cents,
  5000, 'carnet Run vendu sur place');
reset role;
select is((select private.credits_for('72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000002')),
  5, 'crédits utilisables pour Run');
select is((select private.credits_for('72000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001')),
  0, 'pas pour le CrossFit');

-- Accès par discipline
select pg_temp.login_as('71000000-0000-0000-0000-000000000003');
select throws_ok($$select public.book_session('75000000-0000-0000-0000-000000000001')$$,
  'P0001', 'plan_discipline', 'CrossFit refusé : le carnet ne couvre que Run');
select is((public.book_session('75000000-0000-0000-0000-000000000002')).status, 'confirmed'::public.booking_status,
  'Run réservé avec le carnet');
reset role;
select is(private.credit_balance('72000000-0000-0000-0000-000000000001'), 4, 'un crédit débité');
select is((select lot_id is not null from public.credit_ledger
           where reason = 'booking' and member_id = '72000000-0000-0000-0000-000000000001'),
  true, 'débit rattaché à son lot');

-- Lot qui expire le premier consommé d'abord
select pg_temp.login_as('71000000-0000-0000-0000-000000000001');
select lives_ok($$select public.record_manual_sale('72000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000003', 'card', 'MOINS20')$$,
  'carnet 10 vendu avec le code');
select is((select amount_cents from public.payments where promo_code_id = '76000000-0000-0000-0000-000000000001'),
  14400, 'remise appliquée au paiement');
select throws_ok($$select * from public.price_quote('74000000-0000-0000-0000-000000000003', 'MOINS20')$$,
  'P0001', 'promo_exhausted', 'code à usage unique épuisé');
select pg_temp.login_as('71000000-0000-0000-0000-000000000003');
select lives_ok($$select public.book_session('75000000-0000-0000-0000-000000000001')$$, 'CrossFit réservé avec le carnet 10');
select is((select l.plan_id from public.credit_ledger d join public.credit_ledger l on l.id = d.lot_id
           join public.bookings b on b.id = d.booking_id
           where d.reason = 'booking' and b.session_id = '75000000-0000-0000-0000-000000000001'),
  '74000000-0000-0000-0000-000000000003'::uuid, 'débit pris sur le lot qui couvre la discipline');
select lives_ok($$select public.cancel_booking((select id from public.bookings where session_id = '75000000-0000-0000-0000-000000000001'))$$,
  'annulation');
reset role;
select is((select r.lot_id from public.credit_ledger r join public.bookings b on b.id = r.booking_id
           where r.reason = 'booking_refund' and b.session_id = '75000000-0000-0000-0000-000000000001'),
  (select lot_id from public.credit_ledger d join public.bookings b on b.id = d.booking_id
   where d.reason = 'booking' and b.session_id = '75000000-0000-0000-0000-000000000001'),
  'le crédit rendu retourne dans son lot');

-- Expiration : le restant d'un lot échu sort du solde
reset role;
update public.credit_ledger set expires_at = now() - interval '1 hour'
where member_id = '72000000-0000-0000-0000-000000000001' and plan_id = '74000000-0000-0000-0000-000000000002' and lot_id = id;
select is(private.expire_credits(), 1, 'un lot expiré');
select is(private.credit_balance('72000000-0000-0000-0000-000000000001'), 10, 'restant du carnet Run retiré, carnet 10 intact');
select is(private.expire_credits(), 0, 'expiration idempotente');

-- Abonnement suivi à la main : discipline et fin de période
select pg_temp.login_as('71000000-0000-0000-0000-000000000001');
select lives_ok($$select public.record_manual_sale('72000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000001', 'cash')$$,
  'Run club vendu à un prospect');
select is((select status from public.members where id = '72000000-0000-0000-0000-000000000002'), 'active'::public.member_status,
  'le prospect devient actif');
select throws_ok($$select public.record_manual_sale('72000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000001', 'cash')$$,
  'P0001', 'already_subscribed', 'pas deux abonnements');
reset role;
select is(private.seat_denial('72000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000003'), 'plan_discipline',
  'abonnement Run : CrossFit refusé');
select is(private.seat_denial('72000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000002'), null,
  'abonnement Run : Run accepté');
reset role;
update public.subscriptions set current_period_end = now() - interval '1 minute'
where member_id = '72000000-0000-0000-0000-000000000002';
select is(private.close_manual_periods(), 1, 'échéance passée : abonnement en impayé');
select is(private.seat_denial('72000000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000002'), 'payment_overdue',
  'période non renouvelée : accès suspendu (motif : impayé)');
select pg_temp.login_as('71000000-0000-0000-0000-000000000001');
select ok((public.renew_manual_subscription((select id from public.subscriptions where member_id = '72000000-0000-0000-0000-000000000002'), 'card')).current_period_end > now(),
  'renouvellement : nouvelle période');

-- Droits
select pg_temp.login_as('71000000-0000-0000-0000-000000000002');
select throws_ok($$select public.record_manual_sale('72000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000003', 'cash')$$,
  'P0001', 'forbidden', 'accueil sans la stratégie : vente refusée');
reset role;
update public.gyms set settings = settings || '{"staff_can_sell": true}' where id = '7a000000-0000-0000-0000-000000000000';
select pg_temp.login_as('71000000-0000-0000-0000-000000000002');
select lives_ok($$select public.record_manual_sale('72000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000003', 'cash')$$,
  'accueil avec la stratégie : vente enregistrée');
select is((select count(*)::integer from public.payments), 0, 'accueil : historique des paiements toujours invisible');

-- Export des paiements : gérant seulement, journalisé
select throws_ok($$select * from public.export_payments('7a000000-0000-0000-0000-000000000000', current_date - 1, current_date)$$,
  'P0001', 'forbidden', 'accueil : pas d''export des paiements');
select pg_temp.login_as('71000000-0000-0000-0000-000000000001');
create temp table exported as
  select * from public.export_payments('7a000000-0000-0000-0000-000000000000', current_date - 1, current_date + 1);
select is((select (details ->> 'count')::integer from public.audit_log where action = 'payments.export'
           and gym_id = '7a000000-0000-0000-0000-000000000000'),
  (select count(*)::integer from exported),
  'export des paiements journalisé avec son nombre de lignes');

-- Isolation : adhérent et autre salle
select pg_temp.login_as('71000000-0000-0000-0000-000000000005');
select is((select count(*)::integer from public.payments where member_id <> '72000000-0000-0000-0000-000000000003'), 0,
  'un adhérent ne voit que ses paiements');
select pg_temp.login_as('71000000-0000-0000-0000-000000000004');
select is((select count(*)::integer from public.promo_codes where gym_id = '7a000000-0000-0000-0000-000000000000'), 0,
  'une salle ne voit pas les codes d''une autre');

select * from finish();
rollback;
