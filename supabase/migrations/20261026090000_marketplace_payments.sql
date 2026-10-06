-- Marketplace (2/3) : paiement en ligne des commandes et achats groupés (BRIEF §12, 2026-10-06).
-- - La salle est cliente Stripe de la plateforme (gym_billing) ; une commande « à payer » se
--   règle par Stripe Checkout (carte ou SEPA). Le webhook la passe « payée » (mp_payments).
-- - Achats groupés : une campagne sur un produit, à date limite ; chaque salle s'engage sur une
--   quantité et enregistre sa carte sans débit (Checkout en mode « setup »). À la clôture, un
--   admin débite chaque salle au palier atteint par la quantité totale ; sous le minimum, la
--   campagne est annulée et rien n'est débité. Une carte refusée laisse la commande « à payer ».

create type public.mp_campaign_status as enum ('open', 'closed', 'cancelled');
create type public.mp_commitment_status as enum ('pending_card', 'committed', 'charged', 'failed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Client Stripe de la salle (achats auprès de la plateforme), créé au premier paiement.
create table public.gym_billing (
  gym_id uuid primary key references public.gyms (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.mp_campaigns (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.mp_products (id),
  title text not null check (length(title) between 1 and 120),
  description text check (length(description) <= 2000),
  ends_at timestamptz not null,
  -- Quantité totale minimale pour que la campagne ait lieu.
  min_qty integer not null default 1 check (min_qty between 1 and 100000),
  status public.mp_campaign_status not null default 'open',
  closed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mp_campaigns_status_idx on public.mp_campaigns (status, ends_at);
create index mp_campaigns_product_idx on public.mp_campaigns (product_id);

alter table public.mp_orders
  add column paid_at timestamptz,
  add column campaign_id uuid references public.mp_campaigns (id);
create index mp_orders_campaign_idx on public.mp_orders (campaign_id);

create table public.mp_commitments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  campaign_id uuid not null references public.mp_campaigns (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 10000),
  status public.mp_commitment_status not null default 'pending_card',
  stripe_payment_method_id text,
  order_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  unique (campaign_id, gym_id),
  foreign key (order_id, gym_id) references public.mp_orders (id, gym_id)
);
create index mp_commitments_gym_idx on public.mp_commitments (gym_id);
create index mp_commitments_order_idx on public.mp_commitments (order_id, gym_id);

-- Paiements des salles à la plateforme (distincts des paiements des adhérents).
create table public.mp_payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  order_id uuid not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'eur',
  status public.payment_status not null,
  method public.payment_method not null default 'card',
  stripe_payment_intent_id text not null unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  foreign key (order_id, gym_id) references public.mp_orders (id, gym_id) on delete cascade
);
create index mp_payments_order_idx on public.mp_payments (order_id, gym_id);
create index mp_payments_gym_idx on public.mp_payments (gym_id, created_at desc);

create trigger mp_campaigns_set_updated_at before update on public.mp_campaigns
  for each row execute function private.set_updated_at();
create trigger mp_commitments_set_updated_at before update on public.mp_commitments
  for each row execute function private.set_updated_at();
create trigger mp_payments_set_updated_at before update on public.mp_payments
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : lectures seulement, écritures par les fonctions et le webhook (service_role)
-- ---------------------------------------------------------------------------

alter table public.gym_billing enable row level security;
alter table public.mp_campaigns enable row level security;
alter table public.mp_commitments enable row level security;
alter table public.mp_payments enable row level security;

revoke all on public.gym_billing, public.mp_campaigns, public.mp_commitments, public.mp_payments
  from anon, authenticated;
grant select on public.gym_billing, public.mp_campaigns, public.mp_commitments, public.mp_payments
  to authenticated;

create policy "gym_billing_select_manager" on public.gym_billing for select to authenticated
  using ((select private.is_gym_manager(gym_id)));
-- Campagnes visibles de l'équipe des salles (comme le catalogue).
create policy "mp_campaigns_select_team" on public.mp_campaigns for select to authenticated
  using ((select private.is_any_team()) or (select private.is_platform_admin()));
create policy "mp_commitments_select" on public.mp_commitments for select to authenticated
  using ((select private.is_gym_manager(gym_id)) or (select private.is_platform_admin()));
create policy "mp_payments_select" on public.mp_payments for select to authenticated
  using ((select private.is_gym_manager(gym_id)) or (select private.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- Paiement d'une commande
-- ---------------------------------------------------------------------------

-- Ce qu'il faut à l'Edge Function pour ouvrir Stripe Checkout : commande à payer (gérant),
-- lignes, salle et son client Stripe s'il existe.
create function public.mp_payment_context(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order public.mp_orders;
begin
  select * into v_order from public.mp_orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'mp_order_not_found';
  end if;
  if not private.is_gym_manager(v_order.gym_id) then
    raise exception 'forbidden';
  end if;
  if v_order.status <> 'pending_payment' then
    raise exception 'mp_invalid_status';
  end if;
  return jsonb_build_object(
    'order', jsonb_build_object('id', v_order.id, 'gym_id', v_order.gym_id,
      'reference', v_order.reference, 'total_cents', v_order.total_cents,
      'currency', v_order.currency),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'unit', i.unit,
        'quantity', i.quantity, 'unit_price_cents', i.unit_price_cents) order by i.name), '[]')
      from public.mp_order_items i where i.order_id = v_order.id),
    'gym', (select jsonb_build_object('id', g.id, 'name', g.name) from public.gyms g
      where g.id = v_order.gym_id),
    'customer_id', (select b.stripe_customer_id from public.gym_billing b
      where b.gym_id = v_order.gym_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Achats groupés
-- ---------------------------------------------------------------------------

-- Progression des campagnes : quantité engagée (cartes enregistrées), prix du palier atteint et
-- palier suivant, engagement de la salle. Gérant d'une salle ou admin (p_gym_id null : toutes
-- les campagnes, sans engagement propre).
create function public.mp_campaign_progress(p_gym_id uuid default null)
returns table (
  id uuid,
  title text,
  description text,
  product_id uuid,
  product_name text,
  unit text,
  list_price_cents integer,
  ends_at timestamptz,
  status public.mp_campaign_status,
  min_qty integer,
  total_qty integer,
  gyms integer,
  unit_price_cents integer,
  next_min_qty integer,
  next_unit_price_cents integer,
  my_commitment_id uuid,
  my_quantity integer,
  my_status public.mp_commitment_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_gym_id is null and not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  if p_gym_id is not null and not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  return query
  with totals as (
    select c.id,
      coalesce(sum(m.quantity) filter (where m.status in ('committed', 'charged', 'failed')), 0)::integer as total,
      count(m.id) filter (where m.status in ('committed', 'charged', 'failed'))::integer as gyms
    from public.mp_campaigns c
    left join public.mp_commitments m on m.campaign_id = c.id
    group by c.id
  )
  select c.id, c.title, c.description, p.id, p.name, p.unit, p.list_price_cents, c.ends_at,
    c.status, c.min_qty, t.total, t.gyms,
    public.mp_unit_price(p.id, greatest(t.total, 1)),
    nt.min_qty, nt.unit_price_cents,
    mine.id, mine.quantity, mine.status
  from public.mp_campaigns c
  join totals t on t.id = c.id
  join public.mp_products p on p.id = c.product_id
  left join lateral (
    select pt.min_qty, pt.unit_price_cents from public.mp_price_tiers pt
    where pt.product_id = p.id and pt.min_qty > t.total
    order by pt.min_qty limit 1
  ) nt on true
  left join public.mp_commitments mine
    on mine.campaign_id = c.id and mine.gym_id = p_gym_id and mine.status <> 'cancelled'
  where p_gym_id is null or c.status = 'open' or mine.id is not null
  order by (c.status = 'open') desc, c.ends_at;
end;
$$;

-- Création d'une campagne (admin) sur un produit actif à prix.
create function public.mp_create_campaign(
  p_product_id uuid,
  p_ends_at timestamptz,
  p_min_qty integer default 1,
  p_title text default null,
  p_description text default null
)
returns public.mp_campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.mp_products;
  v_campaign public.mp_campaigns;
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  select * into v_product from public.mp_products where id = p_product_id;
  if v_product.id is null or not v_product.is_active or v_product.kind <> 'product'
     or v_product.price_cents is null then
    raise exception 'mp_not_orderable';
  end if;
  if p_ends_at is null or p_ends_at <= now() then
    raise exception 'mp_invalid_date';
  end if;
  insert into public.mp_campaigns (product_id, title, description, ends_at, min_qty, created_by)
  values (p_product_id, coalesce(nullif(trim(p_title), ''), v_product.name),
          nullif(trim(p_description), ''), p_ends_at, coalesce(p_min_qty, 1), (select auth.uid()))
  returning * into v_campaign;
  return v_campaign;
end;
$$;

-- Engagement d'une salle (gérant), ou nouvelle quantité. Renvoie l'engagement, et ce qu'il faut
-- pour enregistrer la carte si elle ne l'est pas encore (client Stripe de la salle, nom).
create function public.mp_commit(p_campaign_id uuid, p_gym_id uuid, p_quantity integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.mp_campaigns;
  v_commitment public.mp_commitments;
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  select * into v_campaign from public.mp_campaigns where id = p_campaign_id;
  if v_campaign.id is null then
    raise exception 'mp_campaign_not_found';
  end if;
  if v_campaign.status <> 'open' or v_campaign.ends_at <= now() then
    raise exception 'mp_campaign_closed';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 10000 then
    raise exception 'mp_invalid_quantity';
  end if;

  insert into public.mp_commitments (gym_id, campaign_id, quantity, created_by)
  values (p_gym_id, p_campaign_id, p_quantity, (select auth.uid()))
  on conflict (campaign_id, gym_id) do update set
    quantity = excluded.quantity,
    -- Un engagement retiré repart sans carte ; un engagement en cours garde la sienne.
    status = case when public.mp_commitments.status = 'cancelled' then 'pending_card'
                  else public.mp_commitments.status end,
    stripe_payment_method_id = case when public.mp_commitments.status = 'cancelled' then null
                                    else public.mp_commitments.stripe_payment_method_id end
  returning * into v_commitment;

  return jsonb_build_object(
    'commitment', jsonb_build_object('id', v_commitment.id, 'gym_id', v_commitment.gym_id,
      'quantity', v_commitment.quantity, 'status', v_commitment.status),
    'campaign', jsonb_build_object('id', v_campaign.id, 'title', v_campaign.title),
    'gym', (select jsonb_build_object('id', g.id, 'name', g.name) from public.gyms g
      where g.id = p_gym_id),
    'customer_id', (select b.stripe_customer_id from public.gym_billing b
      where b.gym_id = p_gym_id));
end;
$$;

-- Retrait d'un engagement tant que la campagne est ouverte (gérant).
create function public.mp_withdraw(p_commitment_id uuid)
returns public.mp_commitments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commitment public.mp_commitments;
begin
  select m.* into v_commitment from public.mp_commitments m
  join public.mp_campaigns c on c.id = m.campaign_id
  where m.id = p_commitment_id
  for update of m;
  if v_commitment.id is null then
    raise exception 'mp_commitment_not_found';
  end if;
  if not private.is_gym_manager(v_commitment.gym_id) then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.mp_campaigns
                 where id = v_commitment.campaign_id and status = 'open') then
    raise exception 'mp_campaign_closed';
  end if;
  update public.mp_commitments set status = 'cancelled', stripe_payment_method_id = null
  where id = p_commitment_id returning * into v_commitment;
  return v_commitment;
end;
$$;

-- Annulation d'une campagne ouverte (admin) : engagements annulés, rien n'est débité.
create function public.mp_cancel_campaign(p_campaign_id uuid)
returns public.mp_campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.mp_campaigns;
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  select * into v_campaign from public.mp_campaigns where id = p_campaign_id for update;
  if v_campaign.id is null then
    raise exception 'mp_campaign_not_found';
  end if;
  if v_campaign.status <> 'open' then
    raise exception 'mp_campaign_closed';
  end if;
  update public.mp_commitments set status = 'cancelled' where campaign_id = p_campaign_id;
  update public.mp_campaigns set status = 'cancelled', closed_at = now()
  where id = p_campaign_id returning * into v_campaign;
  return v_campaign;
end;
$$;

-- Clôture (admin). Sous le minimum : campagne annulée, rien n'est débité. Sinon, une commande
-- « à payer » par salle engagée, au prix du palier atteint par la quantité totale ; l'Edge
-- Function débite ensuite la carte enregistrée de chaque salle (liste `charges`).
create function public.mp_close_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.mp_campaigns;
  v_product public.mp_products;
  v_total integer;
  v_price integer;
  v_commitment public.mp_commitments;
  v_order_id uuid;
  v_charges jsonb := '[]'::jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  select * into v_campaign from public.mp_campaigns where id = p_campaign_id for update;
  if v_campaign.id is null then
    raise exception 'mp_campaign_not_found';
  end if;
  if v_campaign.status <> 'open' then
    raise exception 'mp_campaign_closed';
  end if;
  select * into v_product from public.mp_products where id = v_campaign.product_id;

  -- Sans carte enregistrée, pas d'engagement.
  update public.mp_commitments set status = 'cancelled'
  where campaign_id = p_campaign_id and status = 'pending_card';
  select coalesce(sum(quantity), 0) into v_total from public.mp_commitments
  where campaign_id = p_campaign_id and status = 'committed';

  if v_total = 0 or v_total < v_campaign.min_qty then
    update public.mp_commitments set status = 'cancelled'
    where campaign_id = p_campaign_id and status = 'committed';
    update public.mp_campaigns set status = 'cancelled', closed_at = now()
    where id = p_campaign_id;
    return jsonb_build_object('status', 'cancelled', 'total_qty', v_total, 'charges', '[]'::jsonb);
  end if;

  v_price := public.mp_unit_price(v_product.id, v_total);
  for v_commitment in
    select * from public.mp_commitments
    where campaign_id = p_campaign_id and status = 'committed'
    order by created_at
  loop
    v_order_id := gen_random_uuid();
    insert into public.mp_orders (id, gym_id, reference, total_cents, created_by, campaign_id)
    values (v_order_id, v_commitment.gym_id, private.mp_order_reference(v_order_id),
            v_price * v_commitment.quantity, v_commitment.created_by, p_campaign_id);
    insert into public.mp_order_items (order_id, gym_id, product_id, name, unit, quantity,
                                       unit_price_cents, line_total_cents)
    values (v_order_id, v_commitment.gym_id, v_product.id, v_product.name, v_product.unit,
            v_commitment.quantity, v_price, v_price * v_commitment.quantity);
    update public.mp_commitments set order_id = v_order_id where id = v_commitment.id;
    v_charges := v_charges || jsonb_build_object(
      'order_id', v_order_id,
      'commitment_id', v_commitment.id,
      'gym_id', v_commitment.gym_id,
      'amount_cents', v_price * v_commitment.quantity,
      'currency', 'eur',
      'customer_id', (select b.stripe_customer_id from public.gym_billing b
        where b.gym_id = v_commitment.gym_id),
      'payment_method_id', v_commitment.stripe_payment_method_id);
  end loop;

  update public.mp_campaigns set status = 'closed', closed_at = now() where id = p_campaign_id;
  return jsonb_build_object('status', 'closed', 'total_qty', v_total,
    'unit_price_cents', v_price, 'charges', v_charges);
end;
$$;

revoke all on function
  public.mp_payment_context(uuid),
  public.mp_campaign_progress(uuid),
  public.mp_create_campaign(uuid, timestamptz, integer, text, text),
  public.mp_commit(uuid, uuid, integer),
  public.mp_withdraw(uuid),
  public.mp_cancel_campaign(uuid),
  public.mp_close_campaign(uuid)
from public, anon;
grant execute on function
  public.mp_payment_context(uuid),
  public.mp_campaign_progress(uuid),
  public.mp_create_campaign(uuid, timestamptz, integer, text, text),
  public.mp_commit(uuid, uuid, integer),
  public.mp_withdraw(uuid),
  public.mp_cancel_campaign(uuid),
  public.mp_close_campaign(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Webhook Stripe : les paiements de la marketplace passent avant ceux des adhérents
-- ---------------------------------------------------------------------------

-- Le traitement existant (abonnements, factures, carnets, remboursements) devient privé ;
-- apply_stripe_event garde sa signature et l'appelle pour tout ce qui n'est pas marketplace.
alter function public.apply_stripe_event(jsonb, public.payment_method) set schema private;
alter function private.apply_stripe_event(jsonb, public.payment_method) rename to apply_member_stripe_event;
revoke all on function private.apply_member_stripe_event(jsonb, public.payment_method)
  from public, anon, authenticated, service_role;

-- Paiement d'une commande (Checkout ou débit d'un achat groupé) et carte enregistrée pour un
-- engagement. Idempotence : stripe_events, comme pour les adhérents.
create function private.apply_marketplace_event(p_event jsonb, p_method public.payment_method)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := p_event ->> 'type';
  v_object jsonb := p_event #> '{data,object}';
  v_order public.mp_orders;
  v_succeeded boolean;
begin
  insert into public.stripe_events (id, type) values (p_event ->> 'id', v_type)
  on conflict (id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  if v_type = 'setup_intent.succeeded' then
    update public.mp_commitments
    set status = 'committed', stripe_payment_method_id = private.stripe_id(v_object -> 'payment_method')
    where id::text = v_object #>> '{metadata,commitment_id}'
      and status in ('pending_card', 'committed');
    return 'mp_commitment';
  end if;

  select * into v_order from public.mp_orders where id::text = v_object #>> '{metadata,order_id}';
  if v_order.id is null then
    return 'ignored';
  end if;
  v_succeeded := v_type = 'payment_intent.succeeded';

  insert into public.mp_payments (gym_id, order_id, amount_cents, currency, status, method,
                                  stripe_payment_intent_id, paid_at)
  values (v_order.gym_id, v_order.id, coalesce((v_object ->> 'amount')::integer, v_order.total_cents),
          coalesce(v_object ->> 'currency', v_order.currency),
          case when v_succeeded then 'succeeded' else 'failed' end::public.payment_status,
          coalesce(p_method, 'card'), v_object ->> 'id', case when v_succeeded then now() end)
  on conflict (stripe_payment_intent_id) do update set
    status = excluded.status,
    method = excluded.method,
    paid_at = coalesce(excluded.paid_at, public.mp_payments.paid_at);

  if v_succeeded then
    update public.mp_orders set status = 'paid', paid_at = now()
    where id = v_order.id and status = 'pending_payment';
    update public.mp_commitments set status = 'charged'
    where order_id = v_order.id and status in ('committed', 'failed');
  else
    -- La commande reste « à payer » : le gérant la règle par Checkout.
    update public.mp_commitments set status = 'failed'
    where order_id = v_order.id and status = 'committed';
  end if;
  return 'marketplace';
end;
$$;
revoke all on function private.apply_marketplace_event(jsonb, public.payment_method)
  from public, anon, authenticated, service_role;

create function public.apply_stripe_event(p_event jsonb, p_method public.payment_method default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := p_event ->> 'type';
  v_kind text := p_event #>> '{data,object,metadata,kind}';
begin
  if (v_type in ('payment_intent.succeeded', 'payment_intent.payment_failed') and v_kind = 'marketplace')
     or (v_type = 'setup_intent.succeeded' and v_kind = 'mp_commitment') then
    return private.apply_marketplace_event(p_event, p_method);
  end if;
  return private.apply_member_stripe_event(p_event, p_method);
end;
$$;
revoke all on function public.apply_stripe_event(jsonb, public.payment_method)
  from public, anon, authenticated;
grant execute on function public.apply_stripe_event(jsonb, public.payment_method) to service_role;
