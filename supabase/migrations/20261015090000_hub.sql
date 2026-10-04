-- Hub 360° (BRIEF §7) : conversations de l'assistant Claude, brief hebdomadaire, statistiques
-- de séances pour les outils de l'assistant, message direct validé par le gérant, journal des
-- appels à l'IA.

-- Origine des messages directs du gérant (proposés par l'assistant).
alter type public.message_origin add value if not exists 'direct';

-- ---------------------------------------------------------------------------
-- Conversations (une par utilisateur, dans une salle où il est gérant)
-- ---------------------------------------------------------------------------

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default '' check (length(title) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id)
);
create index ai_conversations_owner_idx on public.ai_conversations (profile_id, gym_id, updated_at desc);
create index ai_conversations_gym_idx on public.ai_conversations (gym_id);
create trigger ai_conversations_set_updated_at before update on public.ai_conversations
  for each row execute function private.set_updated_at();

-- content : { "text": … } pour l'utilisateur ; { "text", "steps", "proposals" } pour l'assistant.
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, gym_id) references public.ai_conversations (id, gym_id) on delete cascade
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);
create index ai_messages_conversation_gym_idx on public.ai_messages (conversation_id, gym_id);

-- Brief hebdomadaire (lundi de la semaine, heure de la salle), généré à la demande.
create table public.weekly_briefs (
  gym_id uuid not null references public.gyms (id),
  week_start date not null,
  content text not null,
  generated_by uuid references public.profiles (id) on delete set null,
  generated_at timestamptz not null default now(),
  primary key (gym_id, week_start)
);
create index weekly_briefs_generated_by_idx on public.weekly_briefs (generated_by);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.weekly_briefs enable row level security;
revoke all on public.ai_conversations, public.ai_messages, public.weekly_briefs from anon, authenticated;
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert on public.ai_messages to authenticated;
grant select, insert, update on public.weekly_briefs to authenticated;

-- Une conversation appartient à son auteur, gérant de la salle.
create function private.is_own_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ai_conversations c
    where c.id = p_conversation_id
      and c.profile_id = (select auth.uid())
      and private.is_gym_manager(c.gym_id)
  );
$$;
revoke all on function private.is_own_conversation(uuid) from public, anon;
grant execute on function private.is_own_conversation(uuid) to authenticated;

create policy "ai_conversations_select_own" on public.ai_conversations
  for select to authenticated
  using (profile_id = (select auth.uid()) and private.is_gym_manager(gym_id));
create policy "ai_conversations_insert_own" on public.ai_conversations
  for insert to authenticated
  with check (profile_id = (select auth.uid()) and private.is_gym_manager(gym_id));
create policy "ai_conversations_update_own" on public.ai_conversations
  for update to authenticated
  using (profile_id = (select auth.uid()) and private.is_gym_manager(gym_id))
  with check (profile_id = (select auth.uid()) and private.is_gym_manager(gym_id));
create policy "ai_conversations_delete_own" on public.ai_conversations
  for delete to authenticated
  using (profile_id = (select auth.uid()) and private.is_gym_manager(gym_id));

create policy "ai_messages_select_own" on public.ai_messages
  for select to authenticated using (private.is_own_conversation(conversation_id));
create policy "ai_messages_insert_own" on public.ai_messages
  for insert to authenticated with check (private.is_own_conversation(conversation_id));

create policy "weekly_briefs_select_manager" on public.weekly_briefs
  for select to authenticated using (private.is_gym_manager(gym_id));
create policy "weekly_briefs_insert_manager" on public.weekly_briefs
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "weekly_briefs_update_manager" on public.weekly_briefs
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));

-- ---------------------------------------------------------------------------
-- Statistiques de séances (outil de l'assistant)
-- ---------------------------------------------------------------------------

-- Séances passées de la période [p_from, p_to] (dates de la salle), éventuellement filtrées
-- par discipline et par heure de début locale (« 18:30 ») : places, présents, absents.
create function public.session_stats(
  p_gym_id uuid,
  p_from date,
  p_to date,
  p_discipline_id uuid default null,
  p_local_time time default null
)
returns table (
  session_id uuid,
  starts_at timestamptz,
  discipline text,
  coaches text,
  capacity integer,
  booked integer,
  attended integer,
  no_show integer,
  waitlisted integer,
  cancelled boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid_period';
  end if;
  select timezone into v_tz from public.gyms where id = p_gym_id;

  return query
  select s.id, s.starts_at, d.name,
    (select string_agg(c.display_name, ', ' order by sc.position)
     from public.session_coaches sc join public.coaches c on c.id = sc.coach_id
     where sc.session_id = s.id),
    s.capacity, s.booked_count,
    (select count(*)::integer from public.bookings b where b.session_id = s.id and b.status = 'attended'),
    (select count(*)::integer from public.bookings b where b.session_id = s.id and b.status = 'no_show'),
    s.waitlist_count,
    s.status = 'cancelled'
  from public.class_sessions s
  join public.disciplines d on d.id = s.discipline_id
  where s.gym_id = p_gym_id
    and s.starts_at >= (p_from::timestamp at time zone v_tz)
    and s.starts_at < ((p_to + 1)::timestamp at time zone v_tz)
    and (p_discipline_id is null or s.discipline_id = p_discipline_id)
    and (p_local_time is null or (s.starts_at at time zone v_tz)::time = p_local_time)
  order by s.starts_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Message direct (proposé par l'assistant, validé par le gérant)
-- ---------------------------------------------------------------------------

-- Relance individuelle : mise en file pour chaque adhérent (variables rendues). Ce n'est pas
-- une campagne : pas de condition de consentement marketing (BRIEF §12). 50 destinataires au plus.
create function public.send_direct_message(p_gym_id uuid, p_member_ids uuid[], p_subject text, p_body text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid;
  v_count integer := 0;
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  if nullif(btrim(coalesce(p_subject, '')), '') is null or nullif(btrim(coalesce(p_body, '')), '') is null
    or cardinality(p_member_ids) = 0 or cardinality(p_member_ids) > 50 then
    raise exception 'invalid_input';
  end if;
  if exists (
    select 1 from unnest(p_member_ids) as x(id)
    where not exists (select 1 from public.members m where m.id = x.id and m.gym_id = p_gym_id)
  ) then
    raise exception 'member_not_found';
  end if;

  for v_member_id in select distinct id from unnest(p_member_ids) as x(id) loop
    perform private.enqueue_message(
      v_member_id, 'direct',
      private.render_template(btrim(p_subject), v_member_id),
      private.render_template(btrim(p_body), v_member_id)
    );
    v_count := v_count + 1;
  end loop;

  insert into public.audit_log (gym_id, actor_id, action, entity, details)
  values (p_gym_id, (select auth.uid()), 'message.direct', 'members',
          jsonb_build_object('count', v_count, 'subject', btrim(p_subject)));
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Journal des appels à l'assistant (sans le contenu des réponses)
-- ---------------------------------------------------------------------------

create function public.log_ai_call(
  p_gym_id uuid,
  p_tools text[],
  p_input_tokens integer,
  p_output_tokens integer,
  p_model text,
  p_conversation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  insert into public.audit_log (gym_id, actor_id, action, entity, entity_id, details)
  values (p_gym_id, (select auth.uid()), 'ai.query', 'ai_conversations', p_conversation_id::text,
          jsonb_build_object('tools', to_jsonb(coalesce(p_tools, '{}')), 'input_tokens', p_input_tokens,
                             'output_tokens', p_output_tokens, 'model', p_model));
end;
$$;

revoke all on function
  public.session_stats(uuid, date, date, uuid, time),
  public.send_direct_message(uuid, uuid[], text, text),
  public.log_ai_call(uuid, text[], integer, integer, text, uuid)
from public, anon;
grant execute on function
  public.session_stats(uuid, date, date, uuid, time),
  public.send_direct_message(uuid, uuid[], text, text),
  public.log_ai_call(uuid, text[], integer, integer, text, uuid)
to authenticated;
