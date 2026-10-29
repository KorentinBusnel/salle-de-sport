-- Demandes du site vitrine, v2 (BRIEF §12, 2026-10-30) : « Commencez gratuitement » (essai, l'équipe
-- ouvre l'accès à la main) et « Nous contacter » (question) passent par le même formulaire.
-- - type de demande `kind` : `trial` (créer ma salle) ou `contact` (question) ; `demo` reste pour
--   les demandes du premier formulaire ;
-- - ville et taille ne sont exigées que pour un essai, le message que pour une question ;
-- - le doublon du jour s'entend par email, jour et type ;
-- - nouveau statut `onboarded` : accès ouvert par l'équipe.

create type public.demo_request_kind as enum ('demo', 'trial', 'contact');
alter type public.demo_request_status add value 'onboarded' after 'demo_done';

alter table public.demo_requests add column kind public.demo_request_kind not null default 'demo';
alter table public.demo_requests alter column kind drop default;
alter table public.demo_requests
  alter column city drop not null,
  alter column members_band drop not null,
  add constraint demo_requests_trial_check
    check (kind <> 'trial' or (city is not null and members_band is not null)),
  add constraint demo_requests_contact_check check (kind <> 'contact' or message is not null);

drop index public.demo_requests_email_day_key;
create unique index demo_requests_email_day_key
  on public.demo_requests (lower(email), created_on, kind);

-- ---------------------------------------------------------------------------
-- Formulaire public
-- ---------------------------------------------------------------------------

drop function public.request_demo(
  text, text, text, text, text, public.demo_members_band, text, text
);

create function public.request_demo(
  p_kind public.demo_request_kind,
  p_full_name text,
  p_gym_name text,
  p_email text,
  p_phone text,
  p_city text,
  p_members_band public.demo_members_band,
  p_current_tool text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_gym_name text := btrim(coalesce(p_gym_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_current_tool text := nullif(btrim(coalesce(p_current_tool, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if p_kind is null
    or p_kind = 'demo'
    or char_length(v_full_name) not between 2 and 80
    or char_length(v_gym_name) not between 2 and 120
    or char_length(v_email) > 120
    or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    or char_length(v_city) not between 2 and 80
    or char_length(v_phone) > 30
    or char_length(v_current_tool) > 80
    or char_length(v_message) > 1000
    or (p_kind = 'trial' and (v_city is null or p_members_band is null))
    or (p_kind = 'contact' and v_message is null) then
    raise exception 'invalid_input';
  end if;

  -- Formulaire sans compte : plafond global contre un envoi en masse.
  if (
    select count(*) from public.demo_requests where created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'too_many_requests';
  end if;

  insert into public.demo_requests (
    kind, full_name, gym_name, email, phone, city, members_band, current_tool, message
  )
  values (
    p_kind, v_full_name, v_gym_name, v_email, v_phone, v_city, p_members_band, v_current_tool,
    v_message
  )
  on conflict (lower(email), created_on, kind) do nothing;
end;
$$;

revoke all on function
  public.request_demo(
    public.demo_request_kind, text, text, text, text, text, public.demo_members_band, text, text
  )
from public;
grant execute on function
  public.request_demo(
    public.demo_request_kind, text, text, text, text, text, public.demo_members_band, text, text
  )
to anon, authenticated;
