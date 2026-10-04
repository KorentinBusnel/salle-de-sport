-- Toute table du schéma public doit avoir la RLS activée (BRIEF §3, §10.3).
-- Ce test couvre automatiquement les tables ajoutées par les futures migrations.
begin;
select plan(2);

select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  $$,
  'toutes les tables de public ont la RLS activée'
);

-- anon ne doit jamais pouvoir écrire, sur aucune table.
select is_empty(
  $$
    select table_name, privilege_type
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
      and privilege_type <> 'SELECT'
  $$,
  'anon n''a aucun droit d''écriture'
);

select * from finish();
rollback;
