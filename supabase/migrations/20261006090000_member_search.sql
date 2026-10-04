-- Recherche d'adhérents pour l'accueil (back office) : nom, prénom, email ou téléphone,
-- insensible à la casse et aux accents, avec filtre de statut et pagination.
--
-- search_members est security invoker : la RLS de members s'applique (l'adhérent ne trouve
-- que sa fiche, l'accueil celles de sa salle) ; le filtre gym_id restreint en plus à la salle
-- demandée.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Normalisation
-- ---------------------------------------------------------------------------

-- Texte comparable : minuscules, sans accents. unaccent() n'est que stable ; en nommant
-- explicitement le dictionnaire, le résultat ne dépend plus du search_path et la fonction
-- peut être déclarée immutable (utilisable dans un index).
create function private.search_text(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_value, '')));
$$;

-- Téléphone comparable : chiffres seuls, sans indicatif français ni 0 initial, de sorte que
-- « 06 12 34 56 78 », « +33 6 12 34 56 78 », « 0033612345678 » et « 0612345678 » donnent
-- tous « 612345678 ». L'indicatif « 33 » sans « + » n'est retiré que sur un numéro complet
-- (11 chiffres ou plus), pour ne pas tronquer une saisie partielle comme « 3345 ».
create function private.phone_digits(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when d like '0033%' then substr(d, 5)
    when ltrim(coalesce(p_value, '')) like '+33%' then substr(d, 3)
    when d like '33%' and length(d) >= 11 then substr(d, 3)
    when d like '0%' then substr(d, 2)
    else d
  end
  from (select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g') as d) as x;
$$;

-- Index trigrammes : recherche « contient » sur le texte et sur le téléphone. Pour une salle
-- de taille courante, le planificateur préfère l'index (gym_id, status) ; ceux-ci servent quand
-- une salle compte beaucoup de fiches.
create index members_search_text_trgm_idx on public.members
  using gin (
    private.search_text(first_name || ' ' || last_name || ' ' || coalesce(email, ''))
    extensions.gin_trgm_ops
  );
create index members_phone_digits_trgm_idx on public.members
  using gin (private.phone_digits(phone) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Recherche
-- ---------------------------------------------------------------------------

-- Chaque mot de la requête doit apparaître dans le prénom, le nom ou l'email (l'ordre des
-- mots est libre : « marie dupont » = « Dupont Marie ») ; ou bien, si la requête contient au
-- moins 4 chiffres, le téléphone normalisé contient ces chiffres normalisés. Requête vide :
-- toutes les fiches. total_count = nombre total de résultats, avant pagination.
create function public.search_members(
  p_gym_id uuid,
  p_query text default null,
  p_statuses public.member_status[] default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  status public.member_status,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      -- Mots en texte normalisé, jokers LIKE échappés.
      coalesce(
        array(
          select '%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%'
          from regexp_split_to_table(private.search_text(btrim(p_query)), '\s+') as w
          where w <> ''
        ),
        '{}'
      ) as patterns,
      length(regexp_replace(coalesce(p_query, ''), '[^0-9]', '', 'g')) >= 4 as has_phone,
      private.phone_digits(p_query) as phone_query
  )
  select m.id, m.first_name, m.last_name, m.email, m.phone, m.status,
         count(*) over () as total_count
  from public.members m, q
  where m.gym_id = p_gym_id
    and (p_statuses is null or cardinality(p_statuses) = 0 or m.status = any (p_statuses))
    and (
      cardinality(q.patterns) = 0
      or (
        -- Le premier mot seul (like simple) permet l'index trigramme ; like all vérifie le reste.
        private.search_text(m.first_name || ' ' || m.last_name || ' ' || coalesce(m.email, ''))
          like q.patterns[1]
        and private.search_text(m.first_name || ' ' || m.last_name || ' ' || coalesce(m.email, ''))
          like all (q.patterns)
      )
      or (
        q.has_phone
        and q.phone_query <> ''
        and private.phone_digits(m.phone) like '%' || q.phone_query || '%'
      )
    )
  order by private.search_text(m.last_name), private.search_text(m.first_name), m.id
  limit least(greatest(coalesce(p_limit, 20), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- La fonction s'exécute avec les droits de l'appelant : il doit pouvoir appeler les
-- fonctions de normalisation (pures, sans accès aux données).
revoke all on function private.search_text(text), private.phone_digits(text) from public, anon;
grant execute on function private.search_text(text), private.phone_digits(text) to authenticated;

revoke all on function
  public.search_members(uuid, text, public.member_status[], integer, integer)
from public, anon;
grant execute on function
  public.search_members(uuid, text, public.member_status[], integer, integer)
to authenticated;
