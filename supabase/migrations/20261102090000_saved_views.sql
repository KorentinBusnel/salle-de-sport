-- Vues enregistrées (BRIEF §12, 2026-10-31) : un tableau ou un kanban d'adhérents (plus tard une
-- vue du planning) avec ses filtres, son tri, ses colonnes et son groupement, sous un nom.
--
-- - Une vue est « personnelle » (son créateur seul la voit et la modifie) ou « d'équipe »
--   (toute l'équipe la voit, le gérant la modifie). L'accueil crée des vues personnelles ;
--   seul le gérant publie une vue d'équipe. Rendre personnelle une vue d'équipe n'est permis
--   qu'à son créateur (la vue redevient la sienne).
-- - Les vues intégrées (onglets de statut) vivent dans le code (packages/shared/src/views.ts),
--   jamais ici. CRUD direct sous RLS, comme `segments` ; la validation des filtres et des
--   colonnes est faite par Zod dans les Server Actions, la base borne les tailles.
-- - Une vue d'équipe survit à la suppression du compte de son auteur (created_by remis à
--   null) ; ses vues personnelles disparaissent avec lui.

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id),
  object text not null check (object in ('members', 'planning')),
  name text not null check (length(btrim(name)) between 1 and 80),
  layout text not null check (layout in ('table', 'kanban', 'week', 'day')),
  -- Miroir de segmentFiltersSchema (vues d'adhérents).
  filters jsonb not null default '{}'::jsonb
    check (jsonb_typeof(filters) = 'object' and pg_column_size(filters) <= 8192),
  sort text check (sort is null or length(sort) <= 40),
  columns text[] not null default '{}' check (cardinality(columns) <= 40),
  -- Kanban : « stage » (étapes déduites) ou « f:<clé> » d'un champ liste.
  group_by text check (group_by is null or length(group_by) <= 48),
  visibility text not null default 'private' check (visibility in ('team', 'private')),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, gym_id),
  -- Une vue personnelle a toujours un propriétaire.
  check (visibility = 'team' or created_by is not null),
  -- Disposition cohérente avec l'objet.
  check (
    (object = 'members' and layout in ('table', 'kanban'))
    or (object = 'planning' and layout in ('week', 'day'))
  )
);
create index saved_views_gym_object_idx on public.saved_views (gym_id, object, position);
create index saved_views_created_by_idx on public.saved_views (created_by);
create trigger saved_views_set_updated_at before update on public.saved_views
  for each row execute function private.set_updated_at();

alter table public.saved_views enable row level security;
revoke all on public.saved_views from anon, authenticated;
grant select, insert, delete on public.saved_views to authenticated;
-- Salle, objet et créateur ne changent jamais.
grant update (name, layout, filters, sort, columns, group_by, visibility, position)
  on public.saved_views to authenticated;

create policy "saved_views_select" on public.saved_views
  for select to authenticated
  using (
    private.is_gym_team(gym_id)
    and (visibility = 'team' or created_by = (select auth.uid()))
  );
create policy "saved_views_insert" on public.saved_views
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (visibility = 'private' and private.is_gym_team(gym_id))
      or (visibility = 'team' and private.is_gym_manager(gym_id))
    )
  );
create policy "saved_views_update" on public.saved_views
  for update to authenticated
  using (
    (visibility = 'private' and created_by = (select auth.uid()))
    or (visibility = 'team' and private.is_gym_manager(gym_id))
  )
  with check (
    (visibility = 'private' and created_by = (select auth.uid()))
    or (visibility = 'team' and private.is_gym_manager(gym_id))
  );
create policy "saved_views_delete" on public.saved_views
  for delete to authenticated
  using (
    (visibility = 'private' and created_by = (select auth.uid()))
    or (visibility = 'team' and private.is_gym_manager(gym_id))
  );

-- Suppression d'un compte : ses vues personnelles partent avec lui (la contrainte exige un
-- propriétaire) ; ses vues d'équipe restent, sans créateur (clé étrangère « set null »).
create function private.saved_views_drop_private()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.saved_views where created_by = old.id and visibility = 'private';
  return old;
end;
$$;
revoke all on function private.saved_views_drop_private() from public, anon, authenticated;

create trigger profiles_drop_private_views before delete on public.profiles
  for each row execute function private.saved_views_drop_private();
