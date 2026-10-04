-- Offres, abonnements, crédits et paiements. Stripe est la source de vérité
-- de la facturation ; ces tables en sont le miroir (BRIEF §8), alimenté par
-- l'Edge Function stripe-webhook (service_role) à partir de la phase 2.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  name text not null,
  description text,
  type public.plan_type not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  -- Abonnement récurrent uniquement.
  billing_interval public.billing_interval,
  commitment_months integer check (commitment_months > 0),
  -- Carnet / séance : nombre de crédits. Récurrent : null = illimité.
  credits integer check (credits > 0),
  -- Durée de validité des crédits d'un carnet.
  validity_days integer check (validity_days > 0),
  stripe_product_id text,
  stripe_price_id text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  check ((type = 'recurring') = (billing_interval is not null)),
  check (type = 'recurring' or credits is not null)
);

-- Disciplines incluses dans une offre (règle d'accès précisée en phase 2).
create table public.plan_disciplines (
  gym_id uuid not null,
  plan_id uuid not null,
  discipline_id uuid not null,
  primary key (plan_id, discipline_id),
  foreign key (plan_id, gym_id) references public.plans (id, gym_id) on delete cascade,
  foreign key (discipline_id, gym_id) references public.disciplines (id, gym_id) on delete cascade
);

-- Abonnements récurrents uniquement (les carnets passent par credit_ledger).
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  member_id uuid not null,
  plan_id uuid not null,
  stripe_subscription_id text unique,
  status public.subscription_status not null,
  started_at timestamptz not null default now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  commitment_ends_at timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  foreign key (member_id, gym_id) references public.members (id, gym_id),
  foreign key (plan_id, gym_id) references public.plans (id, gym_id)
);
create index subscriptions_member_id_idx on public.subscriptions (member_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  member_id uuid not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  status public.payment_status not null,
  method public.payment_method not null,
  description text,
  stripe_invoice_id text unique,
  stripe_payment_intent_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  foreign key (member_id, gym_id) references public.members (id, gym_id)
);
create index payments_member_id_idx on public.payments (member_id);
create index payments_gym_created_at_idx on public.payments (gym_id, created_at);

-- Registre des crédits, en ajout seul : le solde est la somme des mouvements.
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  member_id uuid not null,
  delta integer not null check (delta <> 0),
  reason public.credit_reason not null,
  payment_id uuid,
  booking_id uuid,
  -- Date d'expiration des crédits ajoutés (carnets).
  expires_at timestamptz,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (member_id, gym_id) references public.members (id, gym_id),
  foreign key (payment_id, gym_id) references public.payments (id, gym_id),
  foreign key (booking_id, gym_id) references public.bookings (id, gym_id)
);
create index credit_ledger_member_id_idx on public.credit_ledger (member_id);

-- Idempotence des webhooks Stripe : un event.id n'est traité qu'une fois.
create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

create trigger plans_set_updated_at before update on public.plans
  for each row execute function private.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Droits et RLS. Données financières : l'adhérent (les siennes) et le gérant.
-- Ni l'accueil ni les coachs n'y ont accès (BRIEF §4, §6).
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.plan_disciplines enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.stripe_events enable row level security;

revoke all on
  public.plans, public.plan_disciplines, public.subscriptions, public.payments,
  public.credit_ledger, public.stripe_events
from anon, authenticated;

-- Catalogue d'offres : lisible sans compte.
grant select on public.plans, public.plan_disciplines to anon;
grant select, insert, update, delete on public.plans, public.plan_disciplines to authenticated;
-- Abonnements et paiements : miroir de Stripe, écrits uniquement côté serveur.
grant select on public.subscriptions, public.payments to authenticated;
-- Registre en ajout seul : ajustements manuels par le gérant.
grant select, insert on public.credit_ledger to authenticated;
-- stripe_events : aucun accès client (service_role uniquement).

create policy "plans_select" on public.plans
  for select to anon, authenticated
  using (is_active or private.is_gym_manager(gym_id));
create policy "plans_insert_manager" on public.plans
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "plans_update_manager" on public.plans
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "plans_delete_manager" on public.plans
  for delete to authenticated using (private.is_gym_manager(gym_id));

create policy "plan_disciplines_select_public" on public.plan_disciplines
  for select to anon, authenticated using (true);
create policy "plan_disciplines_insert_manager" on public.plan_disciplines
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "plan_disciplines_update_manager" on public.plan_disciplines
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "plan_disciplines_delete_manager" on public.plan_disciplines
  for delete to authenticated using (private.is_gym_manager(gym_id));

create policy "subscriptions_select" on public.subscriptions
  for select to authenticated
  using (private.is_own_member(member_id) or private.is_gym_manager(gym_id));

create policy "payments_select" on public.payments
  for select to authenticated
  using (private.is_own_member(member_id) or private.is_gym_manager(gym_id));

create policy "credit_ledger_select" on public.credit_ledger
  for select to authenticated
  using (private.is_own_member(member_id) or private.is_gym_manager(gym_id));
create policy "credit_ledger_insert_manager" on public.credit_ledger
  for insert to authenticated
  with check (
    private.is_gym_manager(gym_id)
    and reason = 'manual_adjustment'
    and created_by = (select auth.uid())
  );
