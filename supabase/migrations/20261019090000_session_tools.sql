-- Fiche séance et cours récurrents : « Tous présents » en un appel, aperçu de l'impact d'un
-- changement de créneau d'un cours récurrent.

-- « Tous présents » : set_attendance pour chaque inscrit encore confirmé, dans une transaction
-- (mêmes règles : équipe ou coach de la séance, fenêtre d'ouverture du pointage). Renvoie les
-- réservations pointées, pour « Annuler ».
create function public.set_attendance_many(p_session_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
  v_booking_id uuid;
  v_ids uuid[] := array[]::uuid[];
begin
  select gym_id into v_gym_id from public.class_sessions where id = p_session_id for update;
  if not found then
    raise exception 'session_not_found';
  end if;
  if not private.is_gym_staff(v_gym_id) and not private.is_session_coach(p_session_id) then
    raise exception 'forbidden';
  end if;

  for v_booking_id in
    select id from public.bookings
    where session_id = p_session_id and status = 'confirmed'
    order by booked_at
  loop
    perform public.set_attendance(v_booking_id, 'attended');
    v_ids := v_ids || v_booking_id;
  end loop;
  return v_ids;
end;
$$;

revoke all on function public.set_attendance_many(uuid) from public, anon;
grant execute on function public.set_attendance_many(uuid) to authenticated;

-- Avant de changer le jour, l'heure ou la période d'un cours récurrent (update_template) :
-- séances à venir concernées, dont celles déjà réservées (gardées à l'ancien créneau) et leurs
-- inscrits.
create function public.template_change_preview(p_template_id uuid)
returns table (sessions integer, kept integer, booked integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
begin
  select gym_id into v_gym_id from public.class_templates where id = p_template_id;
  if not found then
    raise exception 'session_not_found';
  end if;
  if not private.is_gym_manager(v_gym_id) then
    raise exception 'forbidden';
  end if;

  return query
  with upcoming as (
    select s.id, s.booked_count, s.waitlist_count,
           exists (select 1 from public.bookings b where b.session_id = s.id) as has_bookings
    from public.class_sessions s
    where s.template_id = p_template_id and s.status = 'scheduled' and s.starts_at > now()
      and not s.is_customized
  )
  select count(*)::integer,
         (count(*) filter (where has_bookings))::integer,
         coalesce(sum(booked_count + waitlist_count) filter (where has_bookings), 0)::integer
  from upcoming;
end;
$$;

revoke all on function public.template_change_preview(uuid) from public, anon;
grant execute on function public.template_change_preview(uuid) to authenticated;
