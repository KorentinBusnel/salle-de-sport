-- Étiquettes déjà utilisées dans la salle (saisie d'étiquettes) : les plus fréquentes d'abord,
-- filtrées sans accents (« etu » trouve « étudiant »), celles qui commencent par la frappe en
-- tête. Réservé à l'accueil et plus.

create function public.tag_suggestions(p_gym_id uuid, p_query text default '', p_limit integer default 8)
returns table (tag text, uses integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := replace(replace(private.search_text(btrim(coalesce(p_query, ''))), '%', ''), '_', '');
begin
  if not private.is_gym_staff(p_gym_id) then
    raise exception 'forbidden';
  end if;

  return query
  select t.tag, count(*)::integer
  from public.members m, unnest(m.tags) as t(tag)
  where m.gym_id = p_gym_id
    and (v_query = '' or private.search_text(t.tag) like '%' || v_query || '%')
  group by t.tag
  order by (v_query <> '' and private.search_text(t.tag) like v_query || '%') desc, count(*) desc, t.tag
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
end;
$$;

revoke all on function public.tag_suggestions(uuid, text, integer) from public, anon;
grant execute on function public.tag_suggestions(uuid, text, integer) to authenticated;
