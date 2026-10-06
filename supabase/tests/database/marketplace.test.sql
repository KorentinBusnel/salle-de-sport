-- Marketplace : catalogue lu par l'équipe et écrit par les admins, coût caché, paliers, panier
-- et commande, devis (réponse, acceptation, expiration), cloisonnement entre salles.
begin;
select plan(24);

insert into auth.users (id, email) values
  ('b1100000-0000-0000-0000-000000000001', 'mp-admin@test.local'),
  ('b1100000-0000-0000-0000-000000000002', 'mp-gerant@test.local'),
  ('b1100000-0000-0000-0000-000000000003', 'mp-accueil@test.local'),
  ('b1100000-0000-0000-0000-000000000004', 'mp-autre@test.local'),
  ('b1100000-0000-0000-0000-000000000005', 'mp-membre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('b1a00000-0000-0000-0000-000000000000', 'Salle MP', 'salle-mpa', 'Europe/Paris'),
  ('b1b00000-0000-0000-0000-000000000000', 'Salle MQ', 'salle-mpb', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('b1a00000-0000-0000-0000-000000000000', 'b1100000-0000-0000-0000-000000000001', 'admin'),
  ('b1a00000-0000-0000-0000-000000000000', 'b1100000-0000-0000-0000-000000000002', 'manager'),
  ('b1a00000-0000-0000-0000-000000000000', 'b1100000-0000-0000-0000-000000000003', 'staff'),
  ('b1b00000-0000-0000-0000-000000000000', 'b1100000-0000-0000-0000-000000000004', 'manager'),
  ('b1a00000-0000-0000-0000-000000000000', 'b1100000-0000-0000-0000-000000000005', 'member');
insert into public.mp_suppliers (id, name) values ('b1200000-0000-0000-0000-000000000001', 'Fournisseur test');
insert into public.mp_categories (id, name) values ('b1300000-0000-0000-0000-000000000001', 'Boissons test');
insert into public.mp_products (id, kind, category_id, supplier_id, name, unit, list_price_cents, price_cents, is_active) values
  ('b1400000-0000-0000-0000-000000000001', 'product', 'b1300000-0000-0000-0000-000000000001', 'b1200000-0000-0000-0000-000000000001', 'Boisson énergie', 'carton de 24', 4800, 3600, true),
  ('b1400000-0000-0000-0000-000000000002', 'service', 'b1300000-0000-0000-0000-000000000001', 'b1200000-0000-0000-0000-000000000001', 'Ménage', null, null, null, true),
  ('b1400000-0000-0000-0000-000000000003', 'product', 'b1300000-0000-0000-0000-000000000001', null, 'Brouillon', null, null, 1000, false);
insert into public.mp_product_costs (product_id, cost_cents) values ('b1400000-0000-0000-0000-000000000001', 2500);
insert into public.mp_price_tiers (product_id, min_qty, unit_price_cents) values
  ('b1400000-0000-0000-0000-000000000001', 10, 3300),
  ('b1400000-0000-0000-0000-000000000001', 50, 3000);

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

-- Catalogue
select pg_temp.login_as('b1100000-0000-0000-0000-000000000003');
select is((select count(*)::integer from public.mp_products where category_id = 'b1300000-0000-0000-0000-000000000001'), 2, 'accueil : produits actifs seulement');
select is((select count(*)::integer from public.mp_suppliers), 0, 'accueil : fournisseurs cachés');
select is((select count(*)::integer from public.mp_product_costs), 0, 'accueil : coût d''achat caché');
select throws_ok($$insert into public.mp_categories (name) values ('Pirate')$$, '42501', null, 'accueil : pas d''écriture au catalogue');
select pg_temp.login_as('b1100000-0000-0000-0000-000000000005');
select is((select count(*)::integer from public.mp_products), 0, 'adhérent : pas de catalogue');
select pg_temp.login_as('b1100000-0000-0000-0000-000000000001');
select is((select count(*)::integer from public.mp_products where category_id = 'b1300000-0000-0000-0000-000000000001'), 3, 'admin : tout le catalogue');
select is((select cost_cents from public.mp_product_costs where product_id = 'b1400000-0000-0000-0000-000000000001'), 2500, 'admin : coût d''achat');
select lives_ok($$update public.mp_products set price_cents = 3500 where id = 'b1400000-0000-0000-0000-000000000001'$$, 'admin : modifie le catalogue');

-- Paliers
select is(public.mp_unit_price('b1400000-0000-0000-0000-000000000001', 9), 3500, 'sous le premier palier : prix réseau');
select is(public.mp_unit_price('b1400000-0000-0000-0000-000000000001', 10), 3300, 'palier 10');
select is(public.mp_unit_price('b1400000-0000-0000-0000-000000000001', 80), 3000, 'palier 50');

-- Panier et commande (gérant)
select pg_temp.login_as('b1100000-0000-0000-0000-000000000002');
select is(public.mp_set_cart_item('b1a00000-0000-0000-0000-000000000000', 'b1400000-0000-0000-0000-000000000001', 12), 12, 'ajout au panier');
select throws_ok($$select public.mp_set_cart_item('b1a00000-0000-0000-0000-000000000000', 'b1400000-0000-0000-0000-000000000002', 1)$$,
  'P0001', 'mp_not_orderable', 'service : sur devis seulement');
select is((public.mp_checkout_cart('b1a00000-0000-0000-0000-000000000000')).total_cents, 39600, 'commande : 12 × 33,00 € (palier 10)');
select is((select count(*)::integer from public.mp_cart_items where gym_id = 'b1a00000-0000-0000-0000-000000000000'), 0, 'panier vidé');
select throws_ok($$select public.mp_checkout_cart('b1a00000-0000-0000-0000-000000000000')$$, 'P0001', 'mp_cart_empty', 'panier vide : refusé');

-- Devis : demande, réponse, acceptation
select is((public.mp_request_quote('b1a00000-0000-0000-0000-000000000000', 'b1400000-0000-0000-0000-000000000002', null, 4, 'Deux passages par semaine')).title,
  'Ménage', 'devis demandé, titre repris du service');
select pg_temp.login_as('b1100000-0000-0000-0000-000000000001');
select is((public.mp_answer_quote((select id from public.mp_quotes where gym_id = 'b1a00000-0000-0000-0000-000000000000' limit 1), 9000, current_date + 15, 'Tarif mensuel')).status,
  'answered'::public.mp_quote_status, 'devis répondu');
select pg_temp.login_as('b1100000-0000-0000-0000-000000000002');
select is((public.mp_accept_quote((select id from public.mp_quotes where gym_id = 'b1a00000-0000-0000-0000-000000000000' limit 1))).total_cents, 36000, 'devis accepté : commande au prix proposé');
select throws_ok($$select public.mp_accept_quote((select id from public.mp_quotes where gym_id = 'b1a00000-0000-0000-0000-000000000000' limit 1))$$, 'P0001', 'mp_invalid_status', 'devis déjà accepté');

-- Cloisonnement entre salles
select pg_temp.login_as('b1100000-0000-0000-0000-000000000004');
select is((select count(*)::integer from public.mp_orders where gym_id = 'b1a00000-0000-0000-0000-000000000000'), 0, 'autre salle : commandes invisibles');
select is((select count(*)::integer from public.mp_quotes where gym_id = 'b1a00000-0000-0000-0000-000000000000'), 0, 'autre salle : devis invisibles');
select throws_ok($$select public.mp_set_cart_item('b1a00000-0000-0000-0000-000000000000', 'b1400000-0000-0000-0000-000000000001', 1)$$,
  'P0001', 'forbidden', 'autre salle : pas de panier chez la voisine');

-- Suivi par la plateforme
select pg_temp.login_as('b1100000-0000-0000-0000-000000000002');
select throws_ok($$select public.mp_set_order_status((select id from public.mp_orders where gym_id = 'b1a00000-0000-0000-0000-000000000000' limit 1), 'paid')$$,
  'P0001', 'forbidden', 'gérant : ne change pas le statut de suivi');
reset role;

select * from finish();
rollback;
