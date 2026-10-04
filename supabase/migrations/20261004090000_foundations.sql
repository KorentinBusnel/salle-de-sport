-- Fondations : schéma privé, types énumérés partagés, utilitaires.

-- Schéma non exposé par l'API (PostgREST) : fonctions d'aide aux policies RLS.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Rôles d'un profil dans une salle (miroir de GYM_ROLES dans packages/shared).
create type public.gym_role as enum ('member', 'coach', 'staff', 'manager', 'admin');

create type public.member_status as enum ('prospect', 'active', 'suspended', 'cancelled');
create type public.employment_type as enum ('employee', 'freelance');
create type public.session_status as enum ('scheduled', 'cancelled');
create type public.booking_status as enum ('confirmed', 'waitlisted', 'cancelled', 'no_show', 'attended');
create type public.plan_type as enum ('recurring', 'pack', 'single');
create type public.billing_interval as enum ('month', 'year');
-- Miroir des statuts d'abonnement Stripe.
create type public.subscription_status as enum (
  'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'unpaid'
);
create type public.credit_reason as enum (
  'purchase', 'renewal', 'booking', 'booking_refund', 'expiration', 'manual_adjustment'
);
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type public.payment_method as enum ('card', 'sepa_debit', 'cash', 'other');
create type public.shift_status as enum ('planned', 'done', 'cancelled');
create type public.interaction_channel as enum ('email', 'whatsapp', 'phone', 'note');
create type public.interaction_direction as enum ('inbound', 'outbound', 'internal');
create type public.campaign_channel as enum ('email', 'whatsapp');
create type public.campaign_status as enum ('draft', 'scheduled', 'sending', 'sent', 'cancelled');
create type public.integration_provider as enum ('gmail', 'whatsapp', 'pennylane', 'stripe');
create type public.integration_status as enum ('disconnected', 'connected', 'error');

-- Met à jour la colonne updated_at à chaque modification.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
