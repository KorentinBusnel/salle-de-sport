-- Marketplace (BRIEF §12, 2026-10-06), PR M1 : catalogue commun aux salles, panier, devis et
-- commandes, sans paiement (PR M2).
-- - le catalogue (fournisseurs, catégories, produits et services, paliers de prix) est commun
--   à toutes les salles et tenu par les administrateurs de la plateforme : un utilisateur qui a
--   le rôle admin dans une salle (private.is_platform_admin) ;
-- - l'équipe d'une salle lit le catalogue ; le gérant remplit le panier, demande des devis,
--   passe et suit ses commandes ; le coût d'achat et les fournisseurs restent aux admins ;
-- - un service (ménage, café…) se commande sur devis ; un produit a un prix réseau et des
--   paliers de volume (palier selon la quantité de la ligne).

create type public.mp_item_kind as enum ('product', 'service');
create type public.mp_quote_status as enum ('requested', 'answered', 'accepted', 'declined', 'expired');
create type public.mp_order_status as enum (
  'pending_payment', 'paid', 'ordered', 'shipped', 'delivered', 'received', 'cancelled'
);

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------

-- Administrateur de la plateforme : admin d'au moins une salle.
create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gym_roles
    where profile_id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Membre de l'équipe d'au moins une salle (lecture du catalogue).
create function private.is_any_team()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gym_roles
    where profile_id = (select auth.uid()) and role in ('coach', 'staff', 'manager', 'admin')
  );
$$;

revoke all on function private.is_platform_admin(), private.is_any_team() from public, anon;
grant execute on function private.is_platform_admin(), private.is_any_team() to authenticated;

-- ---------------------------------------------------------------------------
-- Catalogue (commun aux salles)
-- ---------------------------------------------------------------------------

create table public.mp_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  contact_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mp_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 60),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.mp_products (
  id uuid primary key default gen_random_uuid(),
  kind public.mp_item_kind not null default 'product',
  category_id uuid references public.mp_categories (id) on delete set null,
  supplier_id uuid references public.mp_suppliers (id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 120),
  brand text,
  description text,
  unit text,
  image_path text,
  -- Prix public (barré) et prix réseau négocié, HT, en centimes ; un service n'a pas de prix.
  list_price_cents integer check (list_price_cents >= 0),
  price_cents integer check (price_cents >= 0),
  currency text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  is_active boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'service' or is_active = false or price_cents is not null)
);
create index mp_products_category_idx on public.mp_products (category_id);
create index mp_products_supplier_idx on public.mp_products (supplier_id);

-- Coût d'achat (marge de la plateforme) : administrateurs seulement.
create table public.mp_product_costs (
  product_id uuid primary key references public.mp_products (id) on delete cascade,
  cost_cents integer not null check (cost_cents >= 0),
  updated_at timestamptz not null default now()
);

-- Paliers de volume : prix unitaire à partir d'une quantité.
create table public.mp_price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.mp_products (id) on delete cascade,
  min_qty integer not null check (min_qty >= 2),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  unique (product_id, min_qty)
);

create trigger mp_suppliers_set_updated_at before update on public.mp_suppliers
  for each row execute function private.set_updated_at();
create trigger mp_products_set_updated_at before update on public.mp_products
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Données de la salle : panier, devis, commandes
-- ---------------------------------------------------------------------------

create table public.mp_cart_items (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  product_id uuid not null references public.mp_products (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 10000),
  updated_at timestamptz not null default now(),
  unique (gym_id, product_id),
  unique (id, gym_id)
);
create index mp_cart_items_product_idx on public.mp_cart_items (product_id);

create table public.mp_quotes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  product_id uuid references public.mp_products (id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 160),
  quantity integer not null check (quantity between 1 and 100000),
  message text check (length(message) <= 2000),
  status public.mp_quote_status not null default 'requested',
  unit_price_cents integer check (unit_price_cents >= 0),
  answer_note text check (length(answer_note) <= 2000),
  valid_until date,
  requested_by uuid references public.profiles (id) on delete set null,
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id)
);
create index mp_quotes_gym_idx on public.mp_quotes (gym_id, created_at desc);
create index mp_quotes_product_idx on public.mp_quotes (product_id);
create index mp_quotes_status_idx on public.mp_quotes (status, created_at);

create table public.mp_orders (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  reference text not null unique,
  status public.mp_order_status not null default 'pending_payment',
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'eur',
  quote_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  foreign key (quote_id, gym_id) references public.mp_quotes (id, gym_id)
);
create index mp_orders_gym_idx on public.mp_orders (gym_id, created_at desc);
create index mp_orders_status_idx on public.mp_orders (status, created_at);
create index mp_orders_quote_idx on public.mp_orders (quote_id, gym_id);

create table public.mp_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  gym_id uuid not null,
  product_id uuid references public.mp_products (id) on delete set null,
  -- Instantané à la commande : nom, unité et prix ne bougent plus.
  name text not null,
  unit text,
  quantity integer not null check (quantity >= 1),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  foreign key (order_id, gym_id) references public.mp_orders (id, gym_id) on delete cascade
);
create index mp_order_items_order_idx on public.mp_order_items (order_id, gym_id);
create index mp_order_items_product_idx on public.mp_order_items (product_id);

create trigger mp_cart_items_set_updated_at before update on public.mp_cart_items
  for each row execute function private.set_updated_at();
create trigger mp_quotes_set_updated_at before update on public.mp_quotes
  for each row execute function private.set_updated_at();
create trigger mp_orders_set_updated_at before update on public.mp_orders
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.mp_suppliers enable row level security;
alter table public.mp_categories enable row level security;
alter table public.mp_products enable row level security;
alter table public.mp_product_costs enable row level security;
alter table public.mp_price_tiers enable row level security;
alter table public.mp_cart_items enable row level security;
alter table public.mp_quotes enable row level security;
alter table public.mp_orders enable row level security;
alter table public.mp_order_items enable row level security;

revoke all on public.mp_suppliers, public.mp_categories, public.mp_products,
  public.mp_product_costs, public.mp_price_tiers, public.mp_cart_items, public.mp_quotes,
  public.mp_orders, public.mp_order_items from anon, authenticated;

-- Catalogue : lu par l'équipe des salles, écrit par les administrateurs de la plateforme.
grant select, insert, update, delete on public.mp_suppliers, public.mp_categories,
  public.mp_products, public.mp_product_costs, public.mp_price_tiers to authenticated;

create policy "mp_suppliers_select_admin" on public.mp_suppliers for select to authenticated
  using ((select private.is_platform_admin()));
create policy "mp_suppliers_insert_admin" on public.mp_suppliers for insert to authenticated
  with check ((select private.is_platform_admin()));
create policy "mp_suppliers_update_admin" on public.mp_suppliers for update to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy "mp_suppliers_delete_admin" on public.mp_suppliers for delete to authenticated
  using ((select private.is_platform_admin()));

create policy "mp_categories_select_team" on public.mp_categories for select to authenticated
  using ((select private.is_any_team()));
create policy "mp_categories_insert_admin" on public.mp_categories for insert to authenticated
  with check ((select private.is_platform_admin()));
create policy "mp_categories_update_admin" on public.mp_categories for update to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy "mp_categories_delete_admin" on public.mp_categories for delete to authenticated
  using ((select private.is_platform_admin()));

-- Produits : l'équipe voit les produits actifs, les admins tout le catalogue.
create policy "mp_products_select" on public.mp_products for select to authenticated
  using ((is_active and (select private.is_any_team())) or (select private.is_platform_admin()));
create policy "mp_products_insert_admin" on public.mp_products for insert to authenticated
  with check ((select private.is_platform_admin()));
create policy "mp_products_update_admin" on public.mp_products for update to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy "mp_products_delete_admin" on public.mp_products for delete to authenticated
  using ((select private.is_platform_admin()));

create policy "mp_product_costs_select_admin" on public.mp_product_costs for select to authenticated
  using ((select private.is_platform_admin()));
create policy "mp_product_costs_insert_admin" on public.mp_product_costs for insert to authenticated
  with check ((select private.is_platform_admin()));
create policy "mp_product_costs_update_admin" on public.mp_product_costs for update to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy "mp_product_costs_delete_admin" on public.mp_product_costs for delete to authenticated
  using ((select private.is_platform_admin()));

create policy "mp_price_tiers_select_team" on public.mp_price_tiers for select to authenticated
  using ((select private.is_any_team()));
create policy "mp_price_tiers_insert_admin" on public.mp_price_tiers for insert to authenticated
  with check ((select private.is_platform_admin()));
create policy "mp_price_tiers_update_admin" on public.mp_price_tiers for update to authenticated
  using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
create policy "mp_price_tiers_delete_admin" on public.mp_price_tiers for delete to authenticated
  using ((select private.is_platform_admin()));

-- Panier, devis, commandes : lus par le gérant de la salle (et les admins pour devis et
-- commandes), écrits uniquement par les fonctions ci-dessous.
grant select on public.mp_cart_items, public.mp_quotes, public.mp_orders, public.mp_order_items
  to authenticated;

create policy "mp_cart_items_select_manager" on public.mp_cart_items for select to authenticated
  using ((select private.is_gym_manager(gym_id)));
create policy "mp_quotes_select" on public.mp_quotes for select to authenticated
  using ((select private.is_gym_manager(gym_id)) or (select private.is_platform_admin()));
create policy "mp_orders_select" on public.mp_orders for select to authenticated
  using ((select private.is_gym_manager(gym_id)) or (select private.is_platform_admin()));
create policy "mp_order_items_select" on public.mp_order_items for select to authenticated
  using ((select private.is_gym_manager(gym_id)) or (select private.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- Prix
-- ---------------------------------------------------------------------------

-- Prix unitaire d'un produit pour une quantité : palier le plus haut atteint, sinon prix réseau.
create function public.mp_unit_price(p_product_id uuid, p_quantity integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select t.unit_price_cents from public.mp_price_tiers t
     where t.product_id = p_product_id and t.min_qty <= p_quantity
     order by t.min_qty desc limit 1),
    (select p.price_cents from public.mp_products p where p.id = p_product_id)
  );
$$;

-- Référence lisible d'une commande : « CMD-261006-7B20 ».
create function private.mp_order_reference(p_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select 'CMD-' || to_char(now() at time zone 'utc', 'YYMMDD') || '-'
    || upper(left(replace(p_id::text, '-', ''), 4));
$$;

-- ---------------------------------------------------------------------------
-- Panier et commande (gérant)
-- ---------------------------------------------------------------------------

-- Quantité d'un produit dans le panier de la salle (0 : retiré).
create function public.mp_set_cart_item(p_gym_id uuid, p_product_id uuid, p_quantity integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.mp_products;
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > 10000 then
    raise exception 'invalid_input';
  end if;
  if p_quantity = 0 then
    delete from public.mp_cart_items where gym_id = p_gym_id and product_id = p_product_id;
    return 0;
  end if;
  select * into v_product from public.mp_products where id = p_product_id;
  if not found or not v_product.is_active or v_product.kind <> 'product' or v_product.price_cents is null then
    raise exception 'mp_not_orderable';
  end if;
  insert into public.mp_cart_items (gym_id, product_id, quantity)
  values (p_gym_id, p_product_id, p_quantity)
  on conflict (gym_id, product_id) do update set quantity = excluded.quantity;
  return p_quantity;
end;
$$;

-- Le panier devient une commande « à payer », prix figés au palier atteint ; panier vidé.
create function public.mp_checkout_cart(p_gym_id uuid)
returns public.mp_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.mp_orders;
  v_id uuid := gen_random_uuid();
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.mp_cart_items where gym_id = p_gym_id) then
    raise exception 'mp_cart_empty';
  end if;
  if exists (
    select 1 from public.mp_cart_items c join public.mp_products p on p.id = c.product_id
    where c.gym_id = p_gym_id and (not p.is_active or p.kind <> 'product' or p.price_cents is null)
  ) then
    raise exception 'mp_not_orderable';
  end if;

  insert into public.mp_orders (id, gym_id, reference, total_cents, created_by)
  values (v_id, p_gym_id, private.mp_order_reference(v_id), 0, (select auth.uid()));

  insert into public.mp_order_items (order_id, gym_id, product_id, name, unit, quantity,
                                     unit_price_cents, line_total_cents)
  select v_id, p_gym_id, p.id, p.name, p.unit, c.quantity,
    public.mp_unit_price(p.id, c.quantity),
    public.mp_unit_price(p.id, c.quantity) * c.quantity
  from public.mp_cart_items c
  join public.mp_products p on p.id = c.product_id
  where c.gym_id = p_gym_id;

  update public.mp_orders
  set total_cents = (select coalesce(sum(line_total_cents), 0) from public.mp_order_items where order_id = v_id)
  where id = v_id
  returning * into v_order;

  delete from public.mp_cart_items where gym_id = p_gym_id;
  return v_order;
end;
$$;

-- Annulation d'une commande pas encore payée (gérant).
create function public.mp_cancel_order(p_order_id uuid)
returns public.mp_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.mp_orders;
begin
  select * into v_order from public.mp_orders where id = p_order_id for update;
  if not found then
    raise exception 'mp_order_not_found';
  end if;
  if not private.is_gym_manager(v_order.gym_id) then
    raise exception 'forbidden';
  end if;
  if v_order.status <> 'pending_payment' then
    raise exception 'mp_invalid_status';
  end if;
  update public.mp_orders set status = 'cancelled' where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

-- Réception d'une commande livrée (gérant) ; l'entrée en stock arrive avec la boutique (PR M3).
create function public.mp_receive_order(p_order_id uuid)
returns public.mp_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.mp_orders;
begin
  select * into v_order from public.mp_orders where id = p_order_id for update;
  if not found then
    raise exception 'mp_order_not_found';
  end if;
  if not private.is_gym_manager(v_order.gym_id) then
    raise exception 'forbidden';
  end if;
  if v_order.status not in ('shipped', 'delivered') then
    raise exception 'mp_invalid_status';
  end if;
  update public.mp_orders set status = 'received' where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

-- Suivi d'une commande par la plateforme : payée → commandée → expédiée → livrée, ou annulée.
create function public.mp_set_order_status(p_order_id uuid, p_status public.mp_order_status)
returns public.mp_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.mp_orders;
  v_steps public.mp_order_status[] := array['pending_payment', 'paid', 'ordered', 'shipped', 'delivered', 'received']::public.mp_order_status[];
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  select * into v_order from public.mp_orders where id = p_order_id for update;
  if not found then
    raise exception 'mp_order_not_found';
  end if;
  if v_order.status in ('received', 'cancelled')
    or (p_status <> 'cancelled'
        and array_position(v_steps, p_status) <= array_position(v_steps, v_order.status)) then
    raise exception 'mp_invalid_status';
  end if;
  update public.mp_orders set status = p_status where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Devis
-- ---------------------------------------------------------------------------

-- Demande de devis (gérant) : un produit ou un service du catalogue, ou un besoin libre.
create function public.mp_request_quote(
  p_gym_id uuid, p_product_id uuid, p_title text, p_quantity integer, p_message text
)
returns public.mp_quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.mp_quotes;
  v_title text := btrim(coalesce(p_title, ''));
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  if p_product_id is not null then
    select coalesce(nullif(v_title, ''), name) into v_title
    from public.mp_products where id = p_product_id and is_active;
    if not found then
      raise exception 'mp_not_orderable';
    end if;
  end if;
  if v_title = '' or p_quantity is null or p_quantity < 1 or p_quantity > 100000
    or length(coalesce(p_message, '')) > 2000 then
    raise exception 'invalid_input';
  end if;
  insert into public.mp_quotes (gym_id, product_id, title, quantity, message, requested_by)
  values (p_gym_id, p_product_id, v_title, p_quantity, nullif(btrim(p_message), ''), (select auth.uid()))
  returning * into v_quote;
  return v_quote;
end;
$$;

-- Réponse de la plateforme : prix unitaire et date de validité.
create function public.mp_answer_quote(
  p_quote_id uuid, p_unit_price_cents integer, p_valid_until date, p_note text
)
returns public.mp_quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.mp_quotes;
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  select * into v_quote from public.mp_quotes where id = p_quote_id for update;
  if not found then
    raise exception 'mp_quote_not_found';
  end if;
  if v_quote.status not in ('requested', 'answered') then
    raise exception 'mp_invalid_status';
  end if;
  if p_unit_price_cents is null or p_unit_price_cents < 0 or p_valid_until is null
    or p_valid_until < current_date or length(coalesce(p_note, '')) > 2000 then
    raise exception 'invalid_input';
  end if;
  update public.mp_quotes
  set status = 'answered', unit_price_cents = p_unit_price_cents, valid_until = p_valid_until,
      answer_note = nullif(btrim(p_note), ''), answered_by = (select auth.uid()), answered_at = now()
  where id = p_quote_id
  returning * into v_quote;
  return v_quote;
end;
$$;

-- Acceptation (gérant) : le devis devient une commande à payer, au prix proposé.
create function public.mp_accept_quote(p_quote_id uuid)
returns public.mp_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.mp_quotes;
  v_order public.mp_orders;
  v_id uuid := gen_random_uuid();
  v_unit text;
begin
  select * into v_quote from public.mp_quotes where id = p_quote_id for update;
  if not found then
    raise exception 'mp_quote_not_found';
  end if;
  if not private.is_gym_manager(v_quote.gym_id) then
    raise exception 'forbidden';
  end if;
  if v_quote.status <> 'answered' then
    raise exception 'mp_invalid_status';
  end if;
  if v_quote.valid_until < current_date then
    update public.mp_quotes set status = 'expired' where id = p_quote_id;
    raise exception 'mp_quote_expired';
  end if;
  select unit into v_unit from public.mp_products where id = v_quote.product_id;

  insert into public.mp_orders (id, gym_id, reference, total_cents, quote_id, created_by)
  values (v_id, v_quote.gym_id, private.mp_order_reference(v_id),
          v_quote.unit_price_cents * v_quote.quantity, v_quote.id, (select auth.uid()))
  returning * into v_order;
  insert into public.mp_order_items (order_id, gym_id, product_id, name, unit, quantity,
                                     unit_price_cents, line_total_cents)
  values (v_id, v_quote.gym_id, v_quote.product_id, v_quote.title, v_unit, v_quote.quantity,
          v_quote.unit_price_cents, v_quote.unit_price_cents * v_quote.quantity);
  update public.mp_quotes set status = 'accepted' where id = p_quote_id;
  return v_order;
end;
$$;

create function public.mp_decline_quote(p_quote_id uuid)
returns public.mp_quotes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quote public.mp_quotes;
begin
  select * into v_quote from public.mp_quotes where id = p_quote_id for update;
  if not found then
    raise exception 'mp_quote_not_found';
  end if;
  if not private.is_gym_manager(v_quote.gym_id) then
    raise exception 'forbidden';
  end if;
  if v_quote.status not in ('requested', 'answered') then
    raise exception 'mp_invalid_status';
  end if;
  update public.mp_quotes set status = 'declined' where id = p_quote_id returning * into v_quote;
  return v_quote;
end;
$$;

revoke all on function
  public.mp_unit_price(uuid, integer),
  public.mp_set_cart_item(uuid, uuid, integer),
  public.mp_checkout_cart(uuid),
  public.mp_cancel_order(uuid),
  public.mp_receive_order(uuid),
  public.mp_set_order_status(uuid, public.mp_order_status),
  public.mp_request_quote(uuid, uuid, text, integer, text),
  public.mp_answer_quote(uuid, integer, date, text),
  public.mp_accept_quote(uuid),
  public.mp_decline_quote(uuid)
from public, anon;
grant execute on function
  public.mp_unit_price(uuid, integer),
  public.mp_set_cart_item(uuid, uuid, integer),
  public.mp_checkout_cart(uuid),
  public.mp_cancel_order(uuid),
  public.mp_receive_order(uuid),
  public.mp_set_order_status(uuid, public.mp_order_status),
  public.mp_request_quote(uuid, uuid, text, integer, text),
  public.mp_answer_quote(uuid, integer, date, text),
  public.mp_accept_quote(uuid),
  public.mp_decline_quote(uuid)
to authenticated;
revoke all on function private.mp_order_reference(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Images du catalogue : bucket public, écrit par les administrateurs
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace', 'marketplace', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "marketplace_select_admin" on storage.objects for select to authenticated
  using (bucket_id = 'marketplace' and (select private.is_platform_admin()));
create policy "marketplace_insert_admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'marketplace' and (select private.is_platform_admin()));
create policy "marketplace_update_admin" on storage.objects for update to authenticated
  using (bucket_id = 'marketplace' and (select private.is_platform_admin()))
  with check (bucket_id = 'marketplace' and (select private.is_platform_admin()));
create policy "marketplace_delete_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'marketplace' and (select private.is_platform_admin()));
