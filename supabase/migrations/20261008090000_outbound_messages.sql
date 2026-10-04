-- File d'envoi (BRIEF §12, 2026-10-04) : avis aux inscrits, campagnes et automatisations
-- passent par outbound_messages. Pas d'envoi réel pour l'instant : un job marque les messages
-- « logged » (journalisés). Un futur service d'emails (Edge Function) les passera « sent ».
-- Chaque message est aussi une interaction sortante, visible dans l'historique de l'adhérent.

create type public.message_status as enum ('queued', 'logged', 'sent', 'failed');
create type public.message_origin as enum (
  'session_cancelled', 'session_moved', 'coach_changed', 'campaign', 'automation'
);

create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  member_id uuid not null,
  channel public.campaign_channel not null default 'email',
  -- Adresse au moment de l'envoi (null : la fiche n'a pas d'email, message visible dans l'app).
  to_address text,
  subject text not null,
  body text not null,
  status public.message_status not null default 'queued',
  origin public.message_origin not null,
  -- Objet à l'origine du message : séance, campagne, automatisation.
  ref_id uuid,
  -- Idempotence (automatisations, relances) : un même avis n'est mis en file qu'une fois.
  dedupe_key text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (id, gym_id),
  unique (gym_id, dedupe_key),
  foreign key (member_id, gym_id) references public.members (id, gym_id)
);
create index outbound_messages_gym_created_idx on public.outbound_messages (gym_id, created_at desc);
create index outbound_messages_member_idx on public.outbound_messages (member_id, created_at desc);
create index outbound_messages_queued_idx on public.outbound_messages (created_at) where status = 'queued';

alter table public.outbound_messages enable row level security;
revoke all on public.outbound_messages from anon, authenticated;
grant select on public.outbound_messages to authenticated;

-- Lecture : le gérant pour sa salle, l'adhérent pour ses propres messages. Écriture : fonctions.
create policy "outbound_messages_select" on public.outbound_messages
  for select to authenticated
  using (private.is_gym_manager(gym_id) or private.is_own_member(member_id));

-- ---------------------------------------------------------------------------
-- Mise en file
-- ---------------------------------------------------------------------------

-- Met un message en file et l'ajoute à l'historique de l'adhérent. Renvoie null si la clé
-- de déduplication a déjà servi.
create function private.enqueue_message(
  p_member_id uuid,
  p_origin public.message_origin,
  p_subject text,
  p_body text,
  p_ref_id uuid default null,
  p_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_id uuid;
begin
  select * into v_member from public.members where id = p_member_id;
  if not found then
    raise exception 'member_not_found';
  end if;

  insert into public.outbound_messages
    (gym_id, member_id, to_address, subject, body, origin, ref_id, dedupe_key)
  values
    (v_member.gym_id, v_member.id, v_member.email, p_subject, p_body, p_origin, p_ref_id, p_dedupe_key)
  on conflict (gym_id, dedupe_key) do nothing
  returning id into v_id;

  if v_id is not null then
    insert into public.interactions
      (gym_id, member_id, channel, direction, subject, summary, source_ref, created_by)
    values
      (v_member.gym_id, v_member.id, 'email', 'outbound', p_subject, left(p_body, 500),
       'outbound:' || v_id, (select auth.uid()));
  end if;
  return v_id;
end;
$$;

-- « CrossFit du 12/10 à 18h30 », dans le fuseau de la salle.
create function private.session_label(p_session_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select d.name || ' du '
    || to_char(s.starts_at at time zone g.timezone, 'DD/MM')
    || ' à ' || replace(to_char(s.starts_at at time zone g.timezone, 'FMHH24"h"MI'), 'h00', 'h')
  from public.class_sessions s
  join public.disciplines d on d.id = s.discipline_id
  join public.gyms g on g.id = s.gym_id
  where s.id = p_session_id;
$$;

-- Prévient les inscrits (confirmés et en liste d'attente) d'une séance.
create function private.notify_session_members(
  p_session_id uuid,
  p_origin public.message_origin,
  p_subject text,
  p_body text,
  p_statuses public.booking_status[] default array['confirmed', 'waitlisted']::public.booking_status[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_count integer := 0;
begin
  for v_member_id in
    select distinct member_id from public.bookings
    where session_id = p_session_id and status = any (p_statuses)
  loop
    perform private.enqueue_message(v_member_id, p_origin, p_subject, p_body, p_session_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Livraison simulée : sans service d'emails, les messages en file sont journalisés.
create function private.process_outbound_messages()
returns integer
language sql
security definer
set search_path = ''
as $$
  with done as (
    update public.outbound_messages
    set status = 'logged', processed_at = now()
    where status = 'queued' and created_at <= now()
    returning 1
  )
  select count(*)::integer from done;
$$;

revoke all on function
  private.enqueue_message(uuid, public.message_origin, text, text, uuid, text),
  private.session_label(uuid),
  private.notify_session_members(uuid, public.message_origin, text, text, public.booking_status[]),
  private.process_outbound_messages()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Annulation d'une séance : les inscrits sont prévenus
-- ---------------------------------------------------------------------------

create or replace function public.cancel_session(p_session_id uuid, p_reason text default null)
returns public.class_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions;
  v_booking public.bookings;
  v_label text;
begin
  select * into v_session from public.class_sessions where id = p_session_id for update;
  if not found then
    raise exception 'session_not_found';
  end if;
  if not private.is_gym_manager(v_session.gym_id) then
    raise exception 'forbidden';
  end if;
  if v_session.status = 'cancelled' then
    raise exception 'session_cancelled';
  end if;

  -- Avant l'annulation des réservations : on prévient ceux qui étaient inscrits.
  v_label := private.session_label(p_session_id);
  perform private.notify_session_members(
    p_session_id,
    'session_cancelled',
    'Séance annulée : ' || v_label,
    'La séance ' || v_label || ' est annulée'
      || coalesce(' (' || nullif(btrim(p_reason), '') || ')', '')
      || '. Votre réservation est annulée et, le cas échéant, votre crédit vous est rendu.'
  );

  for v_booking in
    select * from public.bookings
    where session_id = p_session_id and status in ('confirmed', 'waitlisted')
  loop
    perform private.cancel_booking_row(v_booking);
  end loop;

  update public.class_sessions
  set status = 'cancelled', cancellation_reason = p_reason
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

-- Journalisation des messages en file, chaque minute.
select cron.schedule(
  'process-outbound-messages',
  '* * * * *',
  'select private.process_outbound_messages()'
);
