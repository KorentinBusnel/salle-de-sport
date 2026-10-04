-- Salles, profils utilisateurs et rôles par salle (profil × salle × rôle).

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text,
  timezone text not null default 'Europe/Paris',
  -- Règles de réservation (délai d'annulation, pénalités…) : à préciser en phase 1.
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  birth_date date,
  emergency_contact_name text,
  emergency_contact_phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gym_roles (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.gym_role not null,
  created_at timestamptz not null default now(),
  unique (gym_id, profile_id, role)
);
create index gym_roles_profile_id_idx on public.gym_roles (profile_id);

create trigger gyms_set_updated_at before update on public.gyms
  for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Crée le profil à l'inscription (auth.users), avec prénom / nom si fournis.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Fonctions d'aide aux policies. SECURITY DEFINER : elles lisent les tables
-- sans repasser par leurs policies, ce qui évite les récursions RLS.
-- ---------------------------------------------------------------------------

create function private.has_gym_role(p_gym_id uuid, p_roles public.gym_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gym_roles
    where gym_id = p_gym_id
      and profile_id = (select auth.uid())
      and role = any (p_roles)
  );
$$;

-- Gérant ou admin : accès complet à la salle, finances comprises.
create function private.is_gym_manager(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_gym_role(p_gym_id, array['manager', 'admin']::public.gym_role[]);
$$;

-- Accueil et au-dessus : réservations et fiches adhérents, sans finances.
create function private.is_gym_staff(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_gym_role(p_gym_id, array['staff', 'manager', 'admin']::public.gym_role[]);
$$;

-- Tout rôle d'équipe (coach compris) : accès au back office.
create function private.is_gym_team(p_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_gym_role(
    p_gym_id, array['coach', 'staff', 'manager', 'admin']::public.gym_role[]
  );
$$;

-- Le profil courant est-il de l'équipe d'une salle où ce profil a un rôle ?
create function private.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.gym_roles target
    where target.profile_id = p_profile_id
      and private.is_gym_staff(target.gym_id)
  );
$$;

revoke all on all functions in schema private from public;
grant execute on function
  private.has_gym_role(uuid, public.gym_role[]),
  private.is_gym_manager(uuid),
  private.is_gym_staff(uuid),
  private.is_gym_team(uuid),
  private.can_view_profile(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Droits et RLS
-- ---------------------------------------------------------------------------

alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.gym_roles enable row level security;

revoke all on public.gyms, public.profiles, public.gym_roles from anon, authenticated;
grant select on public.gyms to anon, authenticated;
grant update on public.gyms to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.gym_roles to authenticated;

-- gyms : informations publiques ; seuls les gérants modifient leur salle.
create policy "gyms_select_public" on public.gyms
  for select to anon, authenticated using (true);
create policy "gyms_update_manager" on public.gyms
  for update to authenticated
  using (private.is_gym_manager(id))
  with check (private.is_gym_manager(id));

-- profiles : chacun le sien ; l'équipe (hors coach) d'une salle voit les profils de cette salle.
create policy "profiles_select_own_or_staff" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.can_view_profile(id));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- gym_roles : chacun voit ses rôles ; les gérants gèrent les rôles de leur salle,
-- mais seul un admin peut attribuer ou retirer le rôle admin.
create policy "gym_roles_select_own_or_manager" on public.gym_roles
  for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_gym_manager(gym_id));
create policy "gym_roles_insert_manager" on public.gym_roles
  for insert to authenticated
  with check (
    private.is_gym_manager(gym_id)
    and (role <> 'admin' or private.has_gym_role(gym_id, array['admin']::public.gym_role[]))
  );
create policy "gym_roles_update_manager" on public.gym_roles
  for update to authenticated
  using (
    private.is_gym_manager(gym_id)
    and (role <> 'admin' or private.has_gym_role(gym_id, array['admin']::public.gym_role[]))
  )
  with check (
    private.is_gym_manager(gym_id)
    and (role <> 'admin' or private.has_gym_role(gym_id, array['admin']::public.gym_role[]))
  );
create policy "gym_roles_delete_manager" on public.gym_roles
  for delete to authenticated
  using (
    private.is_gym_manager(gym_id)
    and (role <> 'admin' or private.has_gym_role(gym_id, array['admin']::public.gym_role[]))
  );
