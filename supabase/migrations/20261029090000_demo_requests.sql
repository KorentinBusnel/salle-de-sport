-- Demandes de démo du site vitrine Chalk (apps/site, BRIEF §12, 2026-10-29).
-- - un gérant d'une autre salle remplit le formulaire public, sans compte : request_demo est la
--   seule fonction ouverte à anon ; elle valide, ignore un doublon (même email, même jour) et
--   plafonne le nombre de demandes par heure ;
-- - la table est globale (comme le catalogue de la marketplace) et n'est lue que par les admins
--   de la plateforme, qui suivent chaque demande (statut, note) par set_demo_request ;
-- - une demande sans suite depuis 3 ans est effacée (durée de conservation des prospects).

create type public.demo_members_band as enum ('under_100', '100_to_300', '300_to_600', 'over_600');
create type public.demo_request_status as enum ('new', 'contacted', 'demo_done', 'dropped');

create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 80),
  gym_name text not null check (char_length(gym_name) between 2 and 120),
  email text not null check (
    char_length(email) <= 120 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  phone text check (char_length(phone) <= 30),
  city text not null check (char_length(city) between 2 and 80),
  members_band public.demo_members_band not null,
  current_tool text check (char_length(current_tool) <= 80),
  message text check (char_length(message) <= 1000),
  status public.demo_request_status not null default 'new',
  note text check (char_length(note) <= 1000),
  -- Jour UTC de la demande : une seule demande par email et par jour.
  created_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index demo_requests_email_day_key on public.demo_requests (lower(email), created_on);
create index demo_requests_created_at_idx on public.demo_requests (created_at desc);

create trigger demo_requests_set_updated_at before update on public.demo_requests
  for each row execute function private.set_updated_at();

alter table public.demo_requests enable row level security;
revoke all on public.demo_requests from anon, authenticated;
grant select on public.demo_requests to authenticated;
create policy "demo_requests_select_admin" on public.demo_requests for select to authenticated
  using ((select private.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- Formulaire public
-- ---------------------------------------------------------------------------

create function public.request_demo(
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
  v_city text := btrim(coalesce(p_city, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_current_tool text := nullif(btrim(coalesce(p_current_tool, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if char_length(v_full_name) not between 2 and 80
    or char_length(v_gym_name) not between 2 and 120
    or char_length(v_city) not between 2 and 80
    or char_length(v_email) > 120
    or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    or char_length(v_phone) > 30
    or char_length(v_current_tool) > 80
    or char_length(v_message) > 1000
    or p_members_band is null then
    raise exception 'invalid_input';
  end if;

  -- Formulaire sans compte : plafond global contre un envoi en masse.
  if (
    select count(*) from public.demo_requests where created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'too_many_requests';
  end if;

  insert into public.demo_requests (
    full_name, gym_name, email, phone, city, members_band, current_tool, message
  )
  values (
    v_full_name, v_gym_name, v_email, v_phone, v_city, p_members_band, v_current_tool, v_message
  )
  on conflict (lower(email), created_on) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Suivi (admins de la plateforme)
-- ---------------------------------------------------------------------------

create function public.set_demo_request(
  p_id uuid, p_status public.demo_request_status, p_note text
)
returns public.demo_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.demo_requests;
begin
  if not private.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  if char_length(p_note) > 1000 then
    raise exception 'invalid_input';
  end if;
  update public.demo_requests
  set status = coalesce(p_status, status), note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_id
  returning * into v_request;
  if not found then
    raise exception 'demo_request_not_found';
  end if;
  return v_request;
end;
$$;

-- Conservation : une demande sans suite depuis 3 ans est effacée.
create function private.purge_demo_requests()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.demo_requests where updated_at < now() - interval '3 years';
$$;

select cron.schedule('demo-requests-purge', '40 3 * * 0', 'select private.purge_demo_requests();');

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------

revoke all on function private.purge_demo_requests() from public, anon, authenticated;

revoke all on function
  public.request_demo(
    text, text, text, text, text, public.demo_members_band, text, text
  )
from public;
grant execute on function
  public.request_demo(
    text, text, text, text, text, public.demo_members_band, text, text
  )
to anon, authenticated;

revoke all on function public.set_demo_request(uuid, public.demo_request_status, text)
from public, anon;
grant execute on function public.set_demo_request(uuid, public.demo_request_status, text)
to authenticated;
