-- Alerte email des demandes de démo (BRIEF §12, 2026-10-31) : `request_demo` renvoie `true` si
-- la demande est enregistrée, `false` pour un doublon du jour ignoré, pour que le site n'envoie
-- qu'une alerte par demande. Signature, règles et droits inchangés ; le type de retour change,
-- d'où `drop function` puis `create`.

drop function public.request_demo(
  public.demo_request_kind, text, text, text, text, text, public.demo_members_band, text, text
);

create function public.request_demo(
  p_kind public.demo_request_kind,
  p_email text,
  -- Facultatifs : une démo n'a que l'email ; un essai exige nom, salle, ville et taille ; une
  -- question exige nom, salle et message.
  p_full_name text default null,
  p_gym_name text default null,
  p_phone text default null,
  p_city text default null,
  p_members_band public.demo_members_band default null,
  p_current_tool text default null,
  p_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_full_name text := btrim(coalesce(p_full_name, ''));
  v_gym_name text := btrim(coalesce(p_gym_name, ''));
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_members_band public.demo_members_band := p_members_band;
  v_current_tool text := nullif(btrim(coalesce(p_current_tool, '')), '');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if p_kind is null
    or char_length(v_email) > 120
    or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_input';
  end if;

  if p_kind = 'demo' then
    -- Démo depuis le hero : l'email seul, rien d'autre n'est gardé.
    v_full_name := null;
    v_gym_name := null;
    v_city := null;
    v_phone := null;
    v_members_band := null;
    v_current_tool := null;
    v_message := null;
  elsif char_length(v_full_name) not between 2 and 80
    or char_length(v_gym_name) not between 2 and 120
    or char_length(v_city) not between 2 and 80
    or char_length(v_phone) > 30
    or char_length(v_current_tool) > 80
    or char_length(v_message) > 1000
    or (p_kind = 'trial' and (v_city is null or v_members_band is null))
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
    p_kind, v_full_name, v_gym_name, v_email, v_phone, v_city, v_members_band, v_current_tool,
    v_message
  )
  on conflict (lower(email), created_on, kind) do nothing;
  -- Faux pour un doublon du jour ignoré : le site n'envoie alors pas de seconde alerte.
  return found;
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
