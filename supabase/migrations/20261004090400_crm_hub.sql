-- CRM, campagnes et Hub 360° (connecteurs, comptabilité, journal d'audit).
-- Tables créées dès la phase 0 ; elles sont alimentées en phases 3 et 4.

-- Journal unifié des échanges (timeline de la fiche adhérent).
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  member_id uuid,
  channel public.interaction_channel not null,
  direction public.interaction_direction not null,
  subject text,
  summary text,
  occurred_at timestamptz not null default now(),
  -- Identifiant dans la source (message Gmail, WhatsApp…) : évite les doublons de synchro.
  source_ref text,
  source_url text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (gym_id, channel, source_ref),
  foreign key (member_id, gym_id) references public.members (id, gym_id)
);
create index interactions_member_occurred_at_idx on public.interactions (member_id, occurred_at desc);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  name text not null,
  channel public.campaign_channel not null,
  -- Définition du segment ciblé (filtres), évaluée à l'envoi.
  segment jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  status public.campaign_status not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Données Pennylane synchronisées (lecture seule au MVP).
create table public.accounting_entries (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  external_id text not null,
  kind text not null,
  label text,
  category text,
  amount_cents integer not null,
  currency text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  entry_date date not null,
  raw jsonb,
  synced_at timestamptz not null default now(),
  unique (gym_id, external_id)
);
create index accounting_entries_gym_date_idx on public.accounting_entries (gym_id, entry_date);

-- État des connecteurs. Les jetons OAuth sont chiffrés dans Supabase Vault :
-- seule la référence au secret est stockée ici, jamais le jeton.
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  provider public.integration_provider not null,
  -- Compte connecté (ex. adresse Gmail) : plusieurs boîtes possibles par salle.
  account_label text not null default '',
  status public.integration_status not null default 'disconnected',
  vault_secret_id uuid,
  settings jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gym_id, provider, account_label)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  gym_id uuid references public.gyms (id),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_gym_created_at_idx on public.audit_log (gym_id, created_at desc);

create trigger campaigns_set_updated_at before update on public.campaigns
  for each row execute function private.set_updated_at();
create trigger integrations_set_updated_at before update on public.integrations
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Droits et RLS : réservé aux gérants. Synchros et journal écrits côté serveur.
-- ---------------------------------------------------------------------------

alter table public.interactions enable row level security;
alter table public.campaigns enable row level security;
alter table public.accounting_entries enable row level security;
alter table public.integrations enable row level security;
alter table public.audit_log enable row level security;

revoke all on
  public.interactions, public.campaigns, public.accounting_entries, public.integrations,
  public.audit_log
from anon, authenticated;

grant select, insert, update, delete on public.interactions, public.campaigns to authenticated;
grant select on public.accounting_entries, public.integrations, public.audit_log to authenticated;

create policy "interactions_manager" on public.interactions
  for all to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));

create policy "campaigns_manager" on public.campaigns
  for all to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));

create policy "accounting_entries_select_manager" on public.accounting_entries
  for select to authenticated using (private.is_gym_manager(gym_id));

create policy "integrations_select_manager" on public.integrations
  for select to authenticated using (private.is_gym_manager(gym_id));

create policy "audit_log_select_manager" on public.audit_log
  for select to authenticated using (private.is_gym_manager(gym_id));
