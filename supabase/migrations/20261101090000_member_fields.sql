-- Champs personnalisés des adhérents (BRIEF §12, 2026-10-31) : le gérant définit ses propres
-- champs (texte, nombre, date, oui/non, liste, liste multiple) dans les réglages ; l'équipe les
-- renseigne sur la fiche et la liste, et les filtres de segments s'y appliquent.
--
-- - member_fields : définitions par salle (clé immuable, libellé, type, options colorées, ordre,
--   saisie autorisée à l'accueil, actif). Lisibles par toute l'équipe, écrites par les fonctions.
-- - member_field_values : valeurs par adhérent, lisibles par l'accueil, le gérant et les coachs
--   de l'adhérent (même règle que la note « à savoir »), jamais par l'adhérent ; écrites par
--   set_member_field seulement. Supprimer un champ supprime ses valeurs.
-- - Validation des valeurs et filtres en SQL (set_member_field, private.member_field_match) ;
--   miroir Zod dans packages/shared/src/fields.ts.
-- - filter_members gagne la clé « fields » ; search_members accepte p_filters et renvoie
--   les valeurs (fields jsonb).

-- ---------------------------------------------------------------------------
-- Définitions
-- ---------------------------------------------------------------------------

create table public.member_fields (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  -- Slug du libellé à la création, jamais modifié (clé des filtres et des vues).
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null check (length(btrim(label)) between 1 and 60),
  type text not null check (type in ('text', 'number', 'date', 'boolean', 'select', 'multi_select')),
  -- Listes : [{ "value", "label", "tone" }], ton parmi neutral | brand | success | warning | danger.
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  position integer not null default 0,
  staff_can_edit boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  unique (gym_id, key)
);
create index member_fields_gym_position_idx on public.member_fields (gym_id, position);
create trigger member_fields_set_updated_at before update on public.member_fields
  for each row execute function private.set_updated_at();

alter table public.member_fields enable row level security;
revoke all on public.member_fields from anon, authenticated;
grant select on public.member_fields to authenticated;

create policy "member_fields_select_team" on public.member_fields
  for select to authenticated using (private.is_gym_team(gym_id));

-- ---------------------------------------------------------------------------
-- Valeurs
-- ---------------------------------------------------------------------------

create table public.member_field_values (
  gym_id uuid not null,
  member_id uuid not null,
  field_id uuid not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  -- Nullable : le seed tourne sans auth.uid().
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  primary key (member_id, field_id),
  foreign key (member_id, gym_id) references public.members (id, gym_id) on delete cascade,
  foreign key (field_id, gym_id) references public.member_fields (id, gym_id) on delete cascade
);
create index member_field_values_gym_field_idx on public.member_field_values (gym_id, field_id);
create index member_field_values_field_idx on public.member_field_values (field_id);
create index member_field_values_updated_by_idx on public.member_field_values (updated_by);
create trigger member_field_values_set_updated_at before update on public.member_field_values
  for each row execute function private.set_updated_at();

alter table public.member_field_values enable row level security;
revoke all on public.member_field_values from anon, authenticated;
grant select on public.member_field_values to authenticated;

create policy "member_field_values_select" on public.member_field_values
  for select to authenticated
  using (private.is_gym_staff(gym_id) or private.coaches_member(member_id));

-- ---------------------------------------------------------------------------
-- Outils internes : clé d'un libellé, options d'une liste
-- ---------------------------------------------------------------------------

-- Slug d'un libellé (même règle que slugifyFieldKey) : minuscules sans accents, tout le reste
-- en « _ », préfixe « f_ » si la clé ne commence pas par une lettre, 40 caractères au plus.
-- Vide si le libellé n'a aucun caractère exploitable.
create function private.field_key_slug(p_label text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select rtrim(left(case when s = '' then '' when s ~ '^[a-z]' then s else 'f_' || s end, 40), '_')
  from (
    select btrim(regexp_replace(private.search_text(p_label), '[^a-z0-9]+', '_', 'g'), '_') as s
  ) as x;
$$;

-- Options d'une liste, vérifiées et normalisées ([{ value, label, tone }], libellés nettoyés) :
-- tableau de 30 objets au plus, valeur ^[a-z0-9][a-z0-9_]{0,39}$ unique, libellé de 1 à 40
-- caractères, ton connu. Sinon invalid_input.
create function private.field_options_clean(p_options jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_options is null or jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) > 30 then
    raise exception 'invalid_input';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_options) as o
    where jsonb_typeof(o) <> 'object'
      or jsonb_typeof(o -> 'value') is distinct from 'string'
      or jsonb_typeof(o -> 'label') is distinct from 'string'
      or jsonb_typeof(o -> 'tone') is distinct from 'string'
      or (o ->> 'value') !~ '^[a-z0-9][a-z0-9_]{0,39}$'
      or length(btrim(o ->> 'label')) not between 1 and 40
      or (o ->> 'tone') not in ('neutral', 'brand', 'success', 'warning', 'danger')
  ) then
    raise exception 'invalid_input';
  end if;
  if (select count(distinct o ->> 'value') from jsonb_array_elements(p_options) as o)
     <> jsonb_array_length(p_options) then
    raise exception 'invalid_input';
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object('value', o ->> 'value', 'label', btrim(o ->> 'label'), 'tone', o ->> 'tone')
      order by ord)
    from jsonb_array_elements(p_options) with ordinality as x(o, ord)
  ), '[]'::jsonb);
end;
$$;

revoke all on function private.field_key_slug(text), private.field_options_clean(jsonb)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Définitions : création, modification, suppression, ordre (gérant, journalisées)
-- ---------------------------------------------------------------------------

-- Crée un champ : 30 champs actifs au plus par salle (too_many_fields) ; type inconnu, libellé
-- vide, options mal formées ou options sur un champ qui n'est pas une liste : invalid_input.
-- La clé est le slug du libellé, dédoublonnée par suffixe _2, _3… ; le champ arrive en dernier.
create function public.create_member_field(
  p_gym_id uuid,
  p_label text,
  p_type text,
  p_options jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text := btrim(coalesce(p_label, ''));
  v_options jsonb;
  v_base text;
  v_key text;
  v_n integer := 1;
  v_id uuid;
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  -- Verrou sur la salle : plafond et unicité de la clé vérifiés sans concurrence.
  perform 1 from public.gyms where id = p_gym_id for update;
  if (select count(*) from public.member_fields f where f.gym_id = p_gym_id and f.is_active) >= 30 then
    raise exception 'too_many_fields';
  end if;
  if p_type is null
    or p_type not in ('text', 'number', 'date', 'boolean', 'select', 'multi_select')
    or length(v_label) not between 1 and 60 then
    raise exception 'invalid_input';
  end if;
  v_options := private.field_options_clean(coalesce(p_options, '[]'::jsonb));
  if p_type not in ('select', 'multi_select') and v_options <> '[]'::jsonb then
    raise exception 'invalid_input';
  end if;
  v_base := private.field_key_slug(v_label);
  if v_base = '' then
    raise exception 'invalid_input';
  end if;
  v_key := v_base;
  while exists (select 1 from public.member_fields f where f.gym_id = p_gym_id and f.key = v_key) loop
    v_n := v_n + 1;
    v_key := rtrim(left(v_base, 39 - length(v_n::text)), '_') || '_' || v_n;
  end loop;

  insert into public.member_fields (gym_id, key, label, type, options, position)
  values (
    p_gym_id, v_key, v_label, p_type, v_options,
    coalesce((select max(f.position) + 1 from public.member_fields f where f.gym_id = p_gym_id), 0)
  )
  returning id into v_id;

  insert into public.audit_log (gym_id, actor_id, action, entity, entity_id, details)
  values (p_gym_id, (select auth.uid()), 'member_field.create', 'member_fields', v_id::text,
          jsonb_build_object('key', v_key, 'label', v_label, 'type', p_type));
  return v_id;
end;
$$;

-- Modifie un champ : clés acceptées label, options, staff_can_edit, is_active (le type et la clé
-- ne changent pas : invalid_input). Une option retirée est effacée des valeurs : pour une liste
-- simple la ligne disparaît, pour une liste multiple l'élément est retiré (ligne supprimée si vide).
-- Réactiver un champ respecte le plafond de 30 champs actifs.
create function public.update_member_field(p_id uuid, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_field public.member_fields;
  v_label text;
  v_options jsonb;
  v_removed text[] := '{}'::text[];
begin
  select * into v_field from public.member_fields where id = p_id for update;
  if not found then
    raise exception 'field_not_found';
  end if;
  if not private.is_gym_manager(v_field.gym_id) then
    raise exception 'forbidden';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or exists (
    select 1 from jsonb_object_keys(p_changes) as k
    where k not in ('label', 'options', 'staff_can_edit', 'is_active')
  ) then
    raise exception 'invalid_input';
  end if;

  if p_changes ? 'label' then
    if jsonb_typeof(p_changes -> 'label') <> 'string' then
      raise exception 'invalid_input';
    end if;
    v_label := btrim(p_changes ->> 'label');
    if length(v_label) not between 1 and 60 then
      raise exception 'invalid_input';
    end if;
  end if;
  if (p_changes ? 'staff_can_edit' and jsonb_typeof(p_changes -> 'staff_can_edit') <> 'boolean')
    or (p_changes ? 'is_active' and jsonb_typeof(p_changes -> 'is_active') <> 'boolean') then
    raise exception 'invalid_input';
  end if;
  if p_changes ? 'options' then
    v_options := private.field_options_clean(p_changes -> 'options');
    if v_field.type not in ('select', 'multi_select') and v_options <> '[]'::jsonb then
      raise exception 'invalid_input';
    end if;
    v_removed := array(
      select o ->> 'value' from jsonb_array_elements(v_field.options) as o
      where not exists (
        select 1 from jsonb_array_elements(v_options) as n where n ->> 'value' = o ->> 'value'
      )
    );
  end if;
  if (p_changes -> 'is_active') = 'true'::jsonb and not v_field.is_active then
    perform 1 from public.gyms where id = v_field.gym_id for update;
    if (select count(*) from public.member_fields f where f.gym_id = v_field.gym_id and f.is_active) >= 30 then
      raise exception 'too_many_fields';
    end if;
  end if;

  if cardinality(v_removed) > 0 then
    if v_field.type = 'select' then
      delete from public.member_field_values v
      where v.field_id = p_id and v.value in (select to_jsonb(r) from unnest(v_removed) as r);
    else
      update public.member_field_values v set value = v.value - v_removed
      where v.field_id = p_id and v.value ?| v_removed;
      delete from public.member_field_values v where v.field_id = p_id and v.value = '[]'::jsonb;
    end if;
  end if;

  update public.member_fields f
  set label = coalesce(v_label, f.label),
      options = coalesce(v_options, f.options),
      staff_can_edit = coalesce((p_changes ->> 'staff_can_edit')::boolean, f.staff_can_edit),
      is_active = coalesce((p_changes ->> 'is_active')::boolean, f.is_active)
  where f.id = p_id;

  insert into public.audit_log (gym_id, actor_id, action, entity, entity_id, details)
  values (v_field.gym_id, (select auth.uid()), 'member_field.update', 'member_fields', p_id::text,
          jsonb_build_object('key', v_field.key, 'changes', p_changes,
                             'removed_options', to_jsonb(v_removed)));
end;
$$;

-- Supprime un champ et toutes ses valeurs (cascade).
create function public.delete_member_field(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_field public.member_fields;
begin
  select * into v_field from public.member_fields where id = p_id for update;
  if not found then
    raise exception 'field_not_found';
  end if;
  if not private.is_gym_manager(v_field.gym_id) then
    raise exception 'forbidden';
  end if;
  delete from public.member_fields where id = p_id;
  insert into public.audit_log (gym_id, actor_id, action, entity, entity_id, details)
  values (v_field.gym_id, (select auth.uid()), 'member_field.delete', 'member_fields', p_id::text,
          jsonb_build_object('key', v_field.key, 'label', v_field.label, 'type', v_field.type));
end;
$$;

-- Nouvel ordre (identifiants dans l'ordre voulu) ; les champs d'une autre salle sont ignorés.
create function public.reorder_member_fields(p_gym_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  update public.member_fields f set position = (x.ord - 1)::integer
  from unnest(p_ids) with ordinality as x(id, ord)
  where f.id = x.id and f.gym_id = p_gym_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Valeur d'un adhérent (accueil si le champ l'autorise, gérant sinon)
-- ---------------------------------------------------------------------------

-- Enregistre la valeur d'un champ pour un adhérent et la renvoie telle que stockée. null (SQL ou
-- JSON) efface la valeur. Champ inconnu ou inactif : unknown_field. Validation par type
-- (invalid_field_value) : texte nettoyé de 1 à 300 caractères ; nombre entre ± 1 000 000 000 avec
-- 2 décimales au plus ; date ISO « AAAA-MM-JJ » valide ; booléen ; option existante ; liste
-- non vide d'options existantes sans doublon.
create function public.set_member_field(p_member_id uuid, p_key text, p_value jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_field public.member_fields;
  v_text text;
  v_number numeric;
  v_value jsonb;
begin
  select * into v_member from public.members where id = p_member_id;
  if not found then
    raise exception 'member_not_found';
  end if;
  if not private.is_gym_staff(v_member.gym_id) then
    raise exception 'forbidden';
  end if;
  select * into v_field from public.member_fields f
  where f.gym_id = v_member.gym_id and f.key = p_key and f.is_active;
  if not found then
    raise exception 'unknown_field';
  end if;
  if not v_field.staff_can_edit and not private.is_gym_manager(v_member.gym_id) then
    raise exception 'forbidden';
  end if;

  if p_value is null or p_value = 'null'::jsonb then
    delete from public.member_field_values v
    where v.member_id = p_member_id and v.field_id = v_field.id;
    return 'null'::jsonb;
  end if;

  case v_field.type
    when 'text' then
      if jsonb_typeof(p_value) <> 'string' then
        raise exception 'invalid_field_value';
      end if;
      v_text := btrim(p_value #>> '{}');
      if length(v_text) not between 1 and 300 then
        raise exception 'invalid_field_value';
      end if;
      v_value := to_jsonb(v_text);
    when 'number' then
      if jsonb_typeof(p_value) <> 'number' then
        raise exception 'invalid_field_value';
      end if;
      v_number := (p_value #>> '{}')::numeric;
      if v_number not between -1000000000 and 1000000000 or round(v_number, 2) <> v_number then
        raise exception 'invalid_field_value';
      end if;
      v_value := p_value;
    when 'date' then
      if jsonb_typeof(p_value) <> 'string' then
        raise exception 'invalid_field_value';
      end if;
      v_text := p_value #>> '{}';
      if v_text !~ '^\d{4}-\d{2}-\d{2}$' or not pg_input_is_valid(v_text, 'date') then
        raise exception 'invalid_field_value';
      end if;
      v_value := p_value;
    when 'boolean' then
      if jsonb_typeof(p_value) <> 'boolean' then
        raise exception 'invalid_field_value';
      end if;
      v_value := p_value;
    when 'select' then
      if jsonb_typeof(p_value) <> 'string' then
        raise exception 'invalid_field_value';
      end if;
      if not exists (
        select 1 from jsonb_array_elements(v_field.options) as o where o ->> 'value' = p_value #>> '{}'
      ) then
        raise exception 'invalid_field_value';
      end if;
      v_value := p_value;
    when 'multi_select' then
      if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) = 0 then
        raise exception 'invalid_field_value';
      end if;
      if exists (select 1 from jsonb_array_elements(p_value) as e where jsonb_typeof(e) <> 'string') then
        raise exception 'invalid_field_value';
      end if;
      if exists (
        select 1 from jsonb_array_elements_text(p_value) as e
        where not exists (select 1 from jsonb_array_elements(v_field.options) as o where o ->> 'value' = e)
      ) or (select count(distinct e) from jsonb_array_elements_text(p_value) as e) <> jsonb_array_length(p_value) then
        raise exception 'invalid_field_value';
      end if;
      v_value := p_value;
    else
      raise exception 'invalid_field_value';
  end case;

  insert into public.member_field_values (gym_id, member_id, field_id, value, updated_at, updated_by)
  values (v_member.gym_id, p_member_id, v_field.id, v_value, now(), (select auth.uid()))
  on conflict (member_id, field_id) do update
    set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
  return v_value;
end;
$$;

-- ---------------------------------------------------------------------------
-- Usage des champs (accueil et gérant) : nombre de valeurs, répartition par option
-- ---------------------------------------------------------------------------

-- option_counts = {"valeur": n} pour les listes (chaque élément d'une liste multiple), {} sinon.
create function public.member_field_usage(p_gym_id uuid)
returns table (field_id uuid, values_count integer, option_counts jsonb)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.is_gym_staff(p_gym_id) then
    raise exception 'forbidden';
  end if;
  return query
  select f.id,
    (select count(*)::integer from public.member_field_values v where v.field_id = f.id),
    case f.type
      when 'select' then coalesce((
        select jsonb_object_agg(t.k, t.n)
        from (
          select v.value #>> '{}' as k, count(*) as n
          from public.member_field_values v where v.field_id = f.id group by 1
        ) as t
      ), '{}'::jsonb)
      when 'multi_select' then coalesce((
        select jsonb_object_agg(t.k, t.n)
        from (
          select e as k, count(*) as n
          from public.member_field_values v
          cross join lateral jsonb_array_elements_text(v.value) as e
          where v.field_id = f.id group by 1
        ) as t
      ), '{}'::jsonb)
      else '{}'::jsonb
    end
  from public.member_fields f
  where f.gym_id = p_gym_id
  order by f.position, f.key;
end;
$$;

-- ---------------------------------------------------------------------------
-- Filtres : une condition { key, op, value } sur une valeur
-- ---------------------------------------------------------------------------

-- Totale (jamais d'exception) : le type JSON est vérifié avant chaque comparaison, une date
-- n'est convertie que si pg_input_is_valid l'accepte, un opérateur inconnu vaut false.
-- Valeur absente : is_empty vrai, « is false » vrai (un oui/non absent vaut non), le reste faux.
--   is / is_not      égalité des jsonb        contains   texte sans casse ni accents (jokers échappés)
--   gte / lte        nombres                  before / after   dates ISO
--   has_any          la liste contient l'une des valeurs
create function private.member_field_match(p_value jsonb, p_cond jsonb)
returns boolean
language sql
stable
parallel safe
set search_path = ''
as $$
  select coalesce(
    case p_cond ->> 'op'
      when 'is_empty' then
        p_value is null or p_value in ('null'::jsonb, '[]'::jsonb, '""'::jsonb)
      when 'is_not_empty' then
        not (p_value is null or p_value in ('null'::jsonb, '[]'::jsonb, '""'::jsonb))
      when 'is' then
        case when p_value is null then (p_cond -> 'value') = 'false'::jsonb
             else p_value = (p_cond -> 'value') end
      when 'is_not' then
        not case when p_value is null then (p_cond -> 'value') = 'false'::jsonb
                 else p_value = (p_cond -> 'value') end
      when 'contains' then
        case when jsonb_typeof(p_value) = 'string' and jsonb_typeof(p_cond -> 'value') = 'string' then
          private.search_text(p_value #>> '{}') like '%'
            || replace(replace(replace(private.search_text(p_cond ->> 'value'), '\', '\\'), '%', '\%'), '_', '\_')
            || '%'
        end
      when 'gte' then
        case when jsonb_typeof(p_value) = 'number' and jsonb_typeof(p_cond -> 'value') = 'number' then
          (p_value #>> '{}')::numeric >= (p_cond ->> 'value')::numeric
        end
      when 'lte' then
        case when jsonb_typeof(p_value) = 'number' and jsonb_typeof(p_cond -> 'value') = 'number' then
          (p_value #>> '{}')::numeric <= (p_cond ->> 'value')::numeric
        end
      when 'before' then
        case when jsonb_typeof(p_value) = 'string' and jsonb_typeof(p_cond -> 'value') = 'string'
              and pg_input_is_valid(p_value #>> '{}', 'date') and pg_input_is_valid(p_cond ->> 'value', 'date') then
          (p_value #>> '{}')::date < (p_cond ->> 'value')::date
        end
      when 'after' then
        case when jsonb_typeof(p_value) = 'string' and jsonb_typeof(p_cond -> 'value') = 'string'
              and pg_input_is_valid(p_value #>> '{}', 'date') and pg_input_is_valid(p_cond ->> 'value', 'date') then
          (p_value #>> '{}')::date > (p_cond ->> 'value')::date
        end
      when 'has_any' then
        case when jsonb_typeof(p_value) in ('array', 'string') and jsonb_typeof(p_cond -> 'value') = 'array' then
          p_value ?| array(select jsonb_array_elements_text(p_cond -> 'value'))
        end
    end,
    false);
$$;

-- ---------------------------------------------------------------------------
-- filter_members : clé « fields » (conditions combinées en ET, comme le reste)
-- ---------------------------------------------------------------------------

-- Fiches de la salle qui satisfont les filtres (tous combinés en ET). Droits de l'appelant :
-- la RLS s'applique (le solde de crédits n'est visible que des finances ; les valeurs de champ
-- ne le sont que de l'équipe).
--   statuses        ["active", …]        statut parmi la liste
--   tags            ["blessure", …]      au moins un de ces tags
--   inactive_days   14                   aucune séance depuis N jours (ni à venir)
--   discipline_id   uuid                 a déjà réservé cette discipline
--   max_credits     2                    solde de crédits ≤ N
--   joined_since    "2026-09-01"         fiche créée depuis cette date
--   birthday_month  true                 anniversaire ce mois-ci (profil)
--   email_consent   true                 consentement marketing email
--   fields          [{ key, op, value }] conditions sur les champs personnalisés
--                                        (private.member_field_match ; clé inconnue = valeur absente)
create or replace function public.filter_members(p_gym_id uuid, p_filters jsonb)
returns setof public.members
language sql
stable
security invoker
set search_path = ''
as $$
  select m.*
  from public.members m
  join public.gyms g on g.id = m.gym_id
  where m.gym_id = p_gym_id
    and (
      jsonb_typeof(p_filters -> 'statuses') is distinct from 'array'
      or jsonb_array_length(p_filters -> 'statuses') = 0
      or m.status::text in (select jsonb_array_elements_text(p_filters -> 'statuses'))
    )
    and (
      jsonb_typeof(p_filters -> 'tags') is distinct from 'array'
      or jsonb_array_length(p_filters -> 'tags') = 0
      or m.tags && array(select jsonb_array_elements_text(p_filters -> 'tags'))
    )
    and (
      jsonb_typeof(p_filters -> 'inactive_days') is distinct from 'number'
      or (
        coalesce(private.member_last_session_at(m.id), m.created_at)
          < now() - make_interval(days => (p_filters ->> 'inactive_days')::integer)
        and not exists (
          select 1 from public.bookings b
          join public.class_sessions s on s.id = b.session_id
          where b.member_id = m.id and b.status in ('confirmed', 'waitlisted') and s.starts_at > now()
        )
      )
    )
    and (
      jsonb_typeof(p_filters -> 'discipline_id') is distinct from 'string'
      or exists (
        select 1 from public.bookings b
        join public.class_sessions s on s.id = b.session_id
        where b.member_id = m.id
          and b.status <> 'cancelled'
          and s.discipline_id::text = p_filters ->> 'discipline_id'
      )
    )
    and (
      jsonb_typeof(p_filters -> 'max_credits') is distinct from 'number'
      or (select coalesce(sum(l.delta), 0) from public.credit_ledger l where l.member_id = m.id)
        <= (p_filters ->> 'max_credits')::integer
    )
    and (
      jsonb_typeof(p_filters -> 'joined_since') is distinct from 'string'
      or m.created_at >= ((p_filters ->> 'joined_since')::date::timestamp at time zone g.timezone)
    )
    and (
      (p_filters -> 'birthday_month') is distinct from 'true'::jsonb
      or exists (
        select 1 from public.profiles p
        where p.id = m.profile_id
          and extract(month from p.birth_date) = extract(month from now() at time zone g.timezone)
      )
    )
    and (
      (p_filters -> 'email_consent') is distinct from 'true'::jsonb
      or (m.marketing_email_consent_at is not null and m.email is not null)
    )
    and (
      jsonb_typeof(p_filters -> 'fields') is distinct from 'array'
      or not exists (
        select 1
        from jsonb_array_elements(p_filters -> 'fields') as c
        left join public.member_fields f on f.gym_id = m.gym_id and f.key = c ->> 'key'
        left join public.member_field_values v on v.member_id = m.id and v.field_id = f.id
        where not private.member_field_match(v.value, c)
      )
    )
  order by m.last_name, m.first_name, m.id;
$$;

-- ---------------------------------------------------------------------------
-- search_members : filtres de segment (p_filters) et valeurs des champs (fields)
-- ---------------------------------------------------------------------------

drop function public.search_members(uuid, text, public.member_status[], integer, integer, text, text);

-- fields : { clé: valeur } des champs renseignés, {} sinon (et toujours {} pour un adhérent :
-- RLS de member_field_values). p_filters non nul : seules les fiches retenues par filter_members.
create function public.search_members(
  p_gym_id uuid,
  p_query text default null,
  p_statuses public.member_status[] default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_tag text default null,
  -- name | name_desc | recent | status | credits | credits_desc
  p_sort text default 'name',
  p_filters jsonb default null
)
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  status public.member_status,
  tags text[],
  credits integer,
  created_at timestamptz,
  fields jsonb,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
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
  ),
  found as (
    select m.*,
           -- Registre lisible du seul gérant (RLS) : somme nulle pour les autres rôles.
           (select sum(l.delta)::integer from public.credit_ledger l where l.member_id = m.id)
             as balance
    from public.members m, q
    where m.gym_id = p_gym_id
      and (p_statuses is null or cardinality(p_statuses) = 0 or m.status = any (p_statuses))
      and (nullif(btrim(p_tag), '') is null or btrim(p_tag) = any (m.tags))
      and (
        cardinality(q.patterns) = 0
        or (
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
      -- Filtres de segment : évalués une fois (sous-requête non corrélée), puis jointure par id.
      and (p_filters is null or m.id in (select fm.id from public.filter_members(p_gym_id, p_filters) fm))
  )
  select f.id, f.first_name, f.last_name, f.email, f.phone, f.status, f.tags,
         case when private.is_gym_manager(p_gym_id) then coalesce(f.balance, 0) end,
         f.created_at,
         coalesce((
           select jsonb_object_agg(mf.key, v.value)
           from public.member_field_values v
           join public.member_fields mf on mf.id = v.field_id
           where v.member_id = f.id
         ), '{}'::jsonb),
         count(*) over () as total_count
  from found f
  order by
    case when p_sort = 'recent' then f.created_at end desc,
    case when p_sort = 'status' then f.status end,
    case when p_sort = 'credits' then coalesce(f.balance, 0) end,
    case when p_sort = 'credits_desc' then coalesce(f.balance, 0) end desc,
    case when p_sort = 'name_desc' then private.search_text(f.last_name) end desc,
    case when p_sort = 'name_desc' then private.search_text(f.first_name) end desc,
    private.search_text(f.last_name), private.search_text(f.first_name), f.id
  limit least(greatest(coalesce(p_limit, 20), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------

revoke all on function
  public.create_member_field(uuid, text, text, jsonb),
  public.update_member_field(uuid, jsonb),
  public.delete_member_field(uuid),
  public.reorder_member_fields(uuid, uuid[]),
  public.set_member_field(uuid, text, jsonb),
  public.member_field_usage(uuid),
  private.member_field_match(jsonb, jsonb),
  public.filter_members(uuid, jsonb),
  public.search_members(uuid, text, public.member_status[], integer, integer, text, text, jsonb)
from public, anon;
grant execute on function
  public.create_member_field(uuid, text, text, jsonb),
  public.update_member_field(uuid, jsonb),
  public.delete_member_field(uuid),
  public.reorder_member_fields(uuid, uuid[]),
  public.set_member_field(uuid, text, jsonb),
  public.member_field_usage(uuid),
  private.member_field_match(jsonb, jsonb),
  public.filter_members(uuid, jsonb),
  public.search_members(uuid, text, public.member_status[], integer, integer, text, text, jsonb)
to authenticated;
