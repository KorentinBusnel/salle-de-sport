-- Emailing (back office complet, sans envoi réel) : modèles à variables, campagnes vers un
-- segment (consentement email obligatoire), automatisations quotidiennes idempotentes.
-- Tout passe par la file d'envoi (private.enqueue_message).

create type public.automation_kind as enum ('welcome', 'inactive', 'birthday');

-- ---------------------------------------------------------------------------
-- Modèles
-- ---------------------------------------------------------------------------

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  name text not null check (length(btrim(name)) between 1 and 80),
  subject text not null check (length(btrim(subject)) between 1 and 200),
  body text not null check (length(btrim(body)) between 1 and 10000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id)
);
create index email_templates_gym_id_idx on public.email_templates (gym_id);
create index email_templates_created_by_idx on public.email_templates (created_by);
create trigger email_templates_set_updated_at before update on public.email_templates
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Automatisations : une par type et par salle
-- ---------------------------------------------------------------------------

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  kind public.automation_kind not null,
  enabled boolean not null default false,
  template_id uuid,
  -- inactive : {"days": 14}
  params jsonb not null default '{}' check (jsonb_typeof(params) = 'object'),
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  unique (gym_id, kind),
  foreign key (template_id, gym_id) references public.email_templates (id, gym_id)
);
create index automations_template_idx on public.automations (template_id, gym_id);
create trigger automations_set_updated_at before update on public.automations
  for each row execute function private.set_updated_at();

-- Campagnes : segment = {"segment_id": …}, content = {"template_id", "subject", "body"}.
alter table public.campaigns add constraint campaigns_id_gym_key unique (id, gym_id);
create index campaigns_gym_id_idx on public.campaigns (gym_id);
create index campaigns_scheduled_idx on public.campaigns (scheduled_at) where status = 'scheduled';

alter table public.email_templates enable row level security;
alter table public.automations enable row level security;
revoke all on public.email_templates, public.automations from anon, authenticated;
grant select, insert, update, delete on public.email_templates to authenticated;
grant select, insert, update on public.automations to authenticated;

create policy "email_templates_select_manager" on public.email_templates
  for select to authenticated using (private.is_gym_manager(gym_id));
create policy "email_templates_insert_manager" on public.email_templates
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "email_templates_update_manager" on public.email_templates
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));
create policy "email_templates_delete_manager" on public.email_templates
  for delete to authenticated using (private.is_gym_manager(gym_id));

create policy "automations_select_manager" on public.automations
  for select to authenticated using (private.is_gym_manager(gym_id));
create policy "automations_insert_manager" on public.automations
  for insert to authenticated with check (private.is_gym_manager(gym_id));
create policy "automations_update_manager" on public.automations
  for update to authenticated
  using (private.is_gym_manager(gym_id))
  with check (private.is_gym_manager(gym_id));

-- ---------------------------------------------------------------------------
-- Variables : {prenom}, {nom}, {salle}
-- ---------------------------------------------------------------------------

create function private.render_template(p_text text, p_member_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select replace(replace(replace(p_text,
    '{prenom}', m.first_name),
    '{nom}', m.last_name),
    '{salle}', g.name)
  from public.members m
  join public.gyms g on g.id = m.gym_id
  where m.id = p_member_id;
$$;

-- Aperçu d'un texte pour un adhérent de la salle (le premier, à défaut).
create function public.preview_template(
  p_gym_id uuid,
  p_subject text,
  p_body text,
  p_member_id uuid default null
)
returns table (subject text, body text, member_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member public.members;
begin
  if not private.is_gym_manager(p_gym_id) then
    raise exception 'forbidden';
  end if;
  select * into v_member from public.members
  where gym_id = p_gym_id and (p_member_id is null or id = p_member_id)
  order by (status = 'active') desc, last_name, first_name
  limit 1;
  if not found then
    return query select p_subject, p_body, null::text;
    return;
  end if;
  return query select
    private.render_template(p_subject, v_member.id),
    private.render_template(p_body, v_member.id),
    v_member.first_name || ' ' || v_member.last_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Campagnes
-- ---------------------------------------------------------------------------

-- Audience d'un segment : ciblés, et joignables (consentement email + adresse).
create function public.segment_audience(p_segment_id uuid)
returns table (targeted integer, reachable integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer,
         count(*) filter (where marketing_email_consent_at is not null and email is not null)::integer
  from public.segment_members(p_segment_id);
$$;

-- Envoi (mise en file) d'une campagne : seuls les adhérents qui ont consenti à l'email.
create function private.dispatch_campaign(p_campaign_id uuid)
returns public.campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns;
  v_filters jsonb;
  v_member public.members;
  v_targeted integer := 0;
  v_excluded integer := 0;
  v_queued integer := 0;
begin
  select * into v_campaign from public.campaigns where id = p_campaign_id for update;
  if v_campaign.status not in ('draft', 'scheduled') then
    raise exception 'campaign_not_editable';
  end if;
  select filters into v_filters from public.segments
  where id::text = v_campaign.segment ->> 'segment_id' and gym_id = v_campaign.gym_id;
  if v_filters is null then
    raise exception 'segment_not_found';
  end if;

  for v_member in select * from public.filter_members(v_campaign.gym_id, v_filters) loop
    v_targeted := v_targeted + 1;
    if v_member.marketing_email_consent_at is null or v_member.email is null then
      v_excluded := v_excluded + 1;
      continue;
    end if;
    if private.enqueue_message(
      v_member.id,
      'campaign',
      private.render_template(v_campaign.content ->> 'subject', v_member.id),
      private.render_template(v_campaign.content ->> 'body', v_member.id),
      v_campaign.id,
      'campaign:' || v_campaign.id || ':' || v_member.id
    ) is not null then
      v_queued := v_queued + 1;
    end if;
  end loop;

  update public.campaigns
  set status = 'sent', sent_at = now(),
      stats = jsonb_build_object('targeted', v_targeted, 'excluded_no_consent', v_excluded, 'queued', v_queued)
  where id = v_campaign.id
  returning * into v_campaign;
  return v_campaign;
end;
$$;

create function public.send_campaign(p_campaign_id uuid)
returns public.campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
begin
  select gym_id into v_gym_id from public.campaigns where id = p_campaign_id;
  if not found then
    raise exception 'campaign_not_found';
  end if;
  if not private.is_gym_manager(v_gym_id) then
    raise exception 'forbidden';
  end if;
  return private.dispatch_campaign(p_campaign_id);
end;
$$;

-- Campagnes programmées dont l'heure est passée (pg_cron, chaque minute).
create function private.run_scheduled_campaigns()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from public.campaigns where status = 'scheduled' and scheduled_at <= now()
  loop
    begin
      perform private.dispatch_campaign(v_id);
      v_count := v_count + 1;
    exception when others then
      update public.campaigns set status = 'cancelled',
        stats = stats || jsonb_build_object('error', sqlerrm)
      where id = v_id;
    end;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Automatisations
-- ---------------------------------------------------------------------------

create function private.automation_message(p_automation public.automations, p_member_id uuid, p_key text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.enqueue_message(
    p_member_id,
    'automation',
    private.render_template(t.subject, p_member_id),
    private.render_template(t.body, p_member_id),
    p_automation.id,
    p_key
  )
  from public.email_templates t
  where t.id = p_automation.template_id;
$$;

-- Bienvenue : à l'activation d'une fiche (message de service : sans condition de
-- consentement marketing), une seule fois par adhérent.
create function private.members_welcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_automation public.automations;
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status = 'prospect') then
    select * into v_automation from public.automations
    where gym_id = new.gym_id and kind = 'welcome' and enabled and template_id is not null;
    if found then
      perform private.automation_message(v_automation, new.id, 'welcome:' || new.id);
    end if;
  end if;
  return null;
end;
$$;

create trigger members_welcome after insert or update of status on public.members
  for each row execute function private.members_welcome();

-- Relance des inactifs et anniversaires (marketing : consentement email requis). Idempotent :
-- clé par période d'inactivité ou par année.
create function private.run_automations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_automation public.automations;
  v_days integer;
  v_count integer := 0;
  v_member record;
begin
  for v_automation in
    select * from public.automations
    where enabled and template_id is not null and kind in ('inactive', 'birthday')
  loop
    if v_automation.kind = 'inactive' then
      v_days := greatest(coalesce((v_automation.params ->> 'days')::integer, 14), 1);
      for v_member in
        select m.id
        from public.filter_members(
          v_automation.gym_id,
          jsonb_build_object('statuses', jsonb_build_array('active'), 'inactive_days', v_days, 'email_consent', true)
        ) m
      loop
        if private.automation_message(
          v_automation, v_member.id,
          'inactive:' || v_member.id || ':' || coalesce(private.member_last_session_at(v_member.id)::date::text, 'jamais')
        ) is not null then
          v_count := v_count + 1;
        end if;
      end loop;
    else
      for v_member in
        select m.id
        from public.members m
        join public.profiles p on p.id = m.profile_id
        join public.gyms g on g.id = m.gym_id
        where m.gym_id = v_automation.gym_id
          and m.status = 'active'
          and m.email is not null
          and m.marketing_email_consent_at is not null
          and to_char(p.birth_date, 'MM-DD') = to_char(now() at time zone g.timezone, 'MM-DD')
      loop
        if private.automation_message(
          v_automation, v_member.id,
          'birthday:' || v_member.id || ':' || extract(year from now())::text
        ) is not null then
          v_count := v_count + 1;
        end if;
      end loop;
    end if;
    update public.automations set last_run_at = now() where id = v_automation.id;
  end loop;
  return v_count;
end;
$$;

revoke all on function
  private.render_template(text, uuid),
  private.dispatch_campaign(uuid),
  private.run_scheduled_campaigns(),
  private.automation_message(public.automations, uuid, text),
  private.members_welcome(),
  private.run_automations()
from public, anon, authenticated;

revoke all on function
  public.preview_template(uuid, text, text, uuid),
  public.segment_audience(uuid),
  public.send_campaign(uuid)
from public, anon;
grant execute on function
  public.preview_template(uuid, text, text, uuid),
  public.segment_audience(uuid),
  public.send_campaign(uuid)
to authenticated;

select cron.schedule('run-scheduled-campaigns', '* * * * *', 'select private.run_scheduled_campaigns()');
-- 8 h 05 à Paris (6 h 05 UTC l'été) : avant l'ouverture, une fois par jour.
select cron.schedule('run-automations', '5 6 * * *', 'select private.run_automations()');
