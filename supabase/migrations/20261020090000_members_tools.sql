-- Liste des adhérents : solde de crédits et tri calculés en SQL, étiquette ajoutée en lot,
-- export journalisé (gérant), journal des changements de consentement.

-- ---------------------------------------------------------------------------
-- Recherche : solde de crédits (gérant ; null sinon, la RLS du registre l'impose) et tri
-- ---------------------------------------------------------------------------

drop function public.search_members(uuid, text, public.member_status[], integer, integer, text);

create function public.search_members(
  p_gym_id uuid,
  p_query text default null,
  p_statuses public.member_status[] default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_tag text default null,
  -- name | name_desc | recent | status | credits | credits_desc
  p_sort text default 'name'
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
  )
  select f.id, f.first_name, f.last_name, f.email, f.phone, f.status, f.tags,
         case when private.is_gym_manager(p_gym_id) then coalesce(f.balance, 0) end,
         f.created_at,
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

revoke all on function
  public.search_members(uuid, text, public.member_status[], integer, integer, text, text)
from public, anon;
grant execute on function
  public.search_members(uuid, text, public.member_status[], integer, integer, text, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Étiquette ajoutée à plusieurs fiches (accueil et gérant : RLS et droit de colonne)
-- ---------------------------------------------------------------------------

create function public.add_member_tag(p_gym_id uuid, p_member_ids uuid[], p_tag text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tag text := lower(btrim(coalesce(p_tag, '')));
  v_count integer;
begin
  if v_tag = '' or length(v_tag) > 40 then
    raise exception 'invalid_input';
  end if;
  if not private.is_gym_staff(p_gym_id) then
    raise exception 'forbidden';
  end if;
  update public.members
  set tags = array_append(tags, v_tag)
  where gym_id = p_gym_id and id = any (p_member_ids) and not (v_tag = any (tags));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.add_member_tag(uuid, uuid[], text) from public, anon;
grant execute on function public.add_member_tag(uuid, uuid[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- Export (gérant) : coordonnées, statut, crédits et consentements ; chaque export est journalisé
-- ---------------------------------------------------------------------------

create function public.export_members(p_gym_id uuid, p_member_ids uuid[])
returns table (
  first_name text,
  last_name text,
  email text,
  phone text,
  status public.member_status,
  tags text[],
  credits integer,
  email_consent boolean,
  whatsapp_consent boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  select count(*) into v_count
  from public.members where gym_id = p_gym_id and id = any (p_member_ids);
  insert into public.audit_log (gym_id, actor_id, action, entity, details)
  values (p_gym_id, (select auth.uid()), 'members.export', 'members',
          jsonb_build_object('count', v_count));

  return query
  select m.first_name, m.last_name, m.email, m.phone, m.status, m.tags,
         coalesce((select sum(l.delta)::integer from public.credit_ledger l where l.member_id = m.id), 0),
         m.marketing_email_consent_at is not null,
         m.marketing_whatsapp_consent_at is not null,
         m.created_at
  from public.members m
  where m.gym_id = p_gym_id and m.id = any (p_member_ids)
  order by m.last_name, m.first_name;
end;
$$;

revoke all on function public.export_members(uuid, uuid[]) from public, anon;
grant execute on function public.export_members(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Consentements : tout changement (back office, app) est inscrit au journal
-- ---------------------------------------------------------------------------

create function private.log_member_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.marketing_email_consent_at is distinct from old.marketing_email_consent_at then
    insert into public.audit_log (gym_id, actor_id, action, entity, entity_id, details)
    values (new.gym_id, (select auth.uid()), 'member.consent', 'members', new.id::text,
            jsonb_build_object('channel', 'email',
                               'granted', new.marketing_email_consent_at is not null));
  end if;
  if new.marketing_whatsapp_consent_at is distinct from old.marketing_whatsapp_consent_at then
    insert into public.audit_log (gym_id, actor_id, action, entity, entity_id, details)
    values (new.gym_id, (select auth.uid()), 'member.consent', 'members', new.id::text,
            jsonb_build_object('channel', 'whatsapp',
                               'granted', new.marketing_whatsapp_consent_at is not null));
  end if;
  return new;
end;
$$;

revoke all on function private.log_member_consent() from public, anon, authenticated;

create trigger members_log_consent
  after update of marketing_email_consent_at, marketing_whatsapp_consent_at on public.members
  for each row execute function private.log_member_consent();
