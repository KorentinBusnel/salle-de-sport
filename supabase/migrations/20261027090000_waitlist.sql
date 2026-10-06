-- Liste d'attente de la landing de lancement (LANDING_BRIEF.md §6, BRIEF §12, 2026-10-06) :
-- - une adresse par salle intéressée, en minuscules, avec la preuve du consentement (texte de la
--   case cochée et date), la source (UTM) et le formulaire d'origine ;
-- - aucun accès client : seule la Server Action de la landing (clé service_role) appelle
--   join_waitlist ; la table n'a aucune policy ;
-- - limite de débit par clé (empreinte HMAC de l'IP calculée par le serveur, jamais l'IP) :
--   5 tentatives par heure, tentatives effacées au bout d'une heure. Une tentative refusée
--   (invalid_input) annule la transaction et ne compte donc pas.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique
    check (email = lower(btrim(email)) and length(email) between 3 and 254
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  consented_at timestamptz not null default now(),
  consent_text text not null check (length(btrim(consent_text)) between 1 and 500),
  source text not null default 'direct' check (length(source) between 1 and 100),
  utm_medium text check (length(utm_medium) <= 100),
  utm_campaign text check (length(utm_campaign) <= 100),
  placement text not null check (placement in ('hero', 'final')),
  created_at timestamptz not null default now()
);

comment on table public.waitlist is
  'Liste d''attente de la landing : écrite par join_waitlist (service_role), aucun accès client.';

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;

-- Tentatives récentes, pour la limite de débit (schéma private : non exposé par l'API).
create table private.waitlist_attempts (
  client_key text not null,
  attempted_at timestamptz not null default now()
);
create index waitlist_attempts_key_idx on private.waitlist_attempts (client_key, attempted_at);
revoke all on private.waitlist_attempts from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Inscription
-- ---------------------------------------------------------------------------

create function public.join_waitlist(
  p_email text,
  p_consent boolean,
  p_consent_text text,
  p_placement text,
  p_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_client_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  if p_client_key is not null then
    delete from private.waitlist_attempts where attempted_at < now() - interval '1 hour';
    if (
      select count(*) from private.waitlist_attempts where client_key = p_client_key
    ) >= 5 then
      raise exception 'rate_limited';
    end if;
    insert into private.waitlist_attempts (client_key) values (p_client_key);
  end if;

  if p_consent is not true
    or length(btrim(coalesce(p_consent_text, ''))) = 0
    or p_placement is null or p_placement not in ('hero', 'final')
    or length(v_email) not between 3 and 254
    or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_input';
  end if;

  insert into public.waitlist (email, consent_text, source, utm_medium, utm_campaign, placement)
  values (
    v_email,
    btrim(p_consent_text),
    coalesce(nullif(left(btrim(p_source), 100), ''), 'direct'),
    nullif(left(btrim(p_utm_medium), 100), ''),
    nullif(left(btrim(p_utm_campaign), 100), ''),
    p_placement
  )
  on conflict (email) do nothing
  returning id into v_id;

  if v_id is null then
    -- Déjà inscrit : rien ne change (ni consentement ni source d'origine).
    select id into v_id from public.waitlist where email = v_email;
    return jsonb_build_object('status', 'already_joined', 'id', v_id);
  end if;

  return jsonb_build_object('status', 'joined', 'id', v_id);
end;
$$;

revoke all on function public.join_waitlist(text, boolean, text, text, text, text, text, text)
from public, anon, authenticated;
grant execute on function public.join_waitlist(text, boolean, text, text, text, text, text, text)
to service_role;
