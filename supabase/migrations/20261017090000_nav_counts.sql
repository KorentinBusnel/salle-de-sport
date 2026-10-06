-- Pastilles de la barre latérale : comptages légers en un appel (sans les listes de crm_todo),
-- chacun réservé au rôle qui y a droit (null sinon).

create function public.nav_counts(p_gym_id uuid)
returns table (prospects integer, unanswered integer, trials_to_call integer, unpaid integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_staff boolean := private.is_gym_staff(p_gym_id);
  v_manager boolean := private.is_gym_manager(p_gym_id);
begin
  if not private.is_gym_team(p_gym_id) then
    raise exception 'forbidden';
  end if;

  return query
  select
    case when v_staff then (
      select count(*)::integer from public.members m
      where m.gym_id = p_gym_id and m.status = 'prospect'
    ) end,
    case when v_manager then (
      select count(*)::integer from (
        select distinct on (i.member_id) i.direction
        from public.interactions i
        where i.gym_id = p_gym_id and i.member_id is not null
          and i.channel in ('email', 'whatsapp', 'phone') and i.direction in ('inbound', 'outbound')
        order by i.member_id, i.occurred_at desc
      ) last_exchange
      where last_exchange.direction = 'inbound'
    ) end,
    case when v_manager then (
      select count(distinct m.id)::integer
      from public.members m
      join public.bookings b on b.member_id = m.id and b.status = 'attended'
      join public.class_sessions s on s.id = b.session_id
      where m.gym_id = p_gym_id and m.status = 'prospect' and s.starts_at > now() - interval '7 days'
    ) end,
    case when v_manager then (select count(*)::integer from public.unpaid_members(p_gym_id)) end;
end;
$$;

revoke all on function public.nav_counts(uuid) from public, anon;
grant execute on function public.nav_counts(uuid) to authenticated;
