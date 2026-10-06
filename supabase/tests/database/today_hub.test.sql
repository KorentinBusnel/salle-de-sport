-- Accueil orienté action : permanences, note « à savoir », digest du jour, essais du jour,
-- CRM à compléter, impayés.
begin;
select plan(28);

insert into auth.users (id, email) values
  ('d0000001-0000-0000-0000-000000000001', 't-gerant@test.local'),
  ('d0000001-0000-0000-0000-000000000002', 't-accueil@test.local'),
  ('d0000001-0000-0000-0000-000000000003', 't-coach1@test.local'),
  ('d0000001-0000-0000-0000-000000000004', 't-coach2@test.local'),
  ('d0000001-0000-0000-0000-000000000005', 't-membre@test.local'),
  ('d0000001-0000-0000-0000-000000000006', 't-gerant-autre@test.local');
insert into public.gyms (id, name, slug, timezone) values
  ('da000001-0000-0000-0000-000000000000', 'Salle T', 'salle-t-today', 'Europe/Paris'),
  ('db000001-0000-0000-0000-000000000000', 'Salle U', 'salle-u-today', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000001', 'manager'),
  ('da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000002', 'staff'),
  ('da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000003', 'coach'),
  ('da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000004', 'coach'),
  ('da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000005', 'member'),
  ('db000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000006', 'manager');
insert into public.coaches (id, gym_id, profile_id, display_name) values
  ('dc000001-0000-0000-0000-000000000003', 'da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000003', 'Coach Un'),
  ('dc000001-0000-0000-0000-000000000004', 'da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000004', 'Coach Deux');
-- P : prospect sans email (essai) ; N : actif, une séance suivie ; V : habitué ; W : autre salle.
insert into public.members (id, gym_id, profile_id, first_name, last_name, email, phone, status) values
  ('d1000001-0000-0000-0000-000000000001', 'da000001-0000-0000-0000-000000000000', null, 'Paul', 'Prospect', null, '0600000001', 'prospect'),
  ('d1000001-0000-0000-0000-000000000002', 'da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000005', 'Nina', 'Nouvelle', 'nina@test.local', '0600000002', 'active'),
  ('d1000001-0000-0000-0000-000000000003', 'da000001-0000-0000-0000-000000000000', null, 'Victor', 'Habitué', 'victor@test.local', '0600000003', 'active'),
  ('d2000001-0000-0000-0000-000000000001', 'db000001-0000-0000-0000-000000000000', null, 'Wendy', 'Ailleurs', null, null, 'active');
insert into public.disciplines (id, gym_id, name, color) values
  ('d4000001-0000-0000-0000-000000000001', 'da000001-0000-0000-0000-000000000000', 'Renfo', '#2563eb');
-- Séances passées (janvier 2030) puis la séance du jour (15 janvier 2030, 18 h 30 à Paris).
insert into public.class_sessions (id, gym_id, discipline_id, starts_at, ends_at, capacity) values
  ('d6000001-0000-0000-0000-000000000001', 'da000001-0000-0000-0000-000000000000', 'd4000001-0000-0000-0000-000000000001', '2030-01-08 17:30+00', '2030-01-08 18:30+00', 10),
  ('d6000001-0000-0000-0000-000000000002', 'da000001-0000-0000-0000-000000000000', 'd4000001-0000-0000-0000-000000000001', '2030-01-10 17:30+00', '2030-01-10 18:30+00', 10),
  ('d6000001-0000-0000-0000-000000000003', 'da000001-0000-0000-0000-000000000000', 'd4000001-0000-0000-0000-000000000001', '2030-01-12 17:30+00', '2030-01-12 18:30+00', 10),
  ('d6000001-0000-0000-0000-000000000009', 'da000001-0000-0000-0000-000000000000', 'd4000001-0000-0000-0000-000000000001', '2030-01-15 17:30+00', '2030-01-15 18:30+00', 10);
insert into public.session_coaches (gym_id, session_id, coach_id) values
  ('da000001-0000-0000-0000-000000000000', 'd6000001-0000-0000-0000-000000000009', 'dc000001-0000-0000-0000-000000000003');
insert into public.bookings (gym_id, session_id, member_id, status) values
  ('da000001-0000-0000-0000-000000000000', 'd6000001-0000-0000-0000-000000000001', 'd1000001-0000-0000-0000-000000000002', 'attended'),
  ('da000001-0000-0000-0000-000000000000', 'd6000001-0000-0000-0000-000000000001', 'd1000001-0000-0000-0000-000000000003', 'attended'),
  ('da000001-0000-0000-0000-000000000000', 'd6000001-0000-0000-0000-000000000002', 'd1000001-0000-0000-0000-000000000003', 'attended'),
  ('da000001-0000-0000-0000-000000000000', 'd6000001-0000-0000-0000-000000000003', 'd1000001-0000-0000-0000-000000000003', 'attended'),
  ('da000001-0000-0000-0000-000000000000', 'd6000001-0000-0000-0000-000000000009', 'd1000001-0000-0000-0000-000000000001', 'confirmed'),
  ('da000001-0000-0000-0000-000000000000', 'd6000001-0000-0000-0000-000000000009', 'd1000001-0000-0000-0000-000000000002', 'confirmed'),
  ('da000001-0000-0000-0000-000000000000', 'd6000001-0000-0000-0000-000000000009', 'd1000001-0000-0000-0000-000000000003', 'confirmed');
-- N : un paiement réussi puis deux échecs ; V : à jour.
insert into public.payments (gym_id, member_id, amount_cents, status, method, created_at, stripe_invoice_id) values
  ('da000001-0000-0000-0000-000000000000', 'd1000001-0000-0000-0000-000000000002', 6900, 'succeeded', 'sepa_debit', '2029-11-01', 'in_th0'),
  ('da000001-0000-0000-0000-000000000000', 'd1000001-0000-0000-0000-000000000002', 6900, 'failed', 'sepa_debit', '2029-12-01', 'in_th1'),
  ('da000001-0000-0000-0000-000000000000', 'd1000001-0000-0000-0000-000000000002', 6900, 'failed', 'sepa_debit', '2029-12-05', 'in_th2'),
  ('da000001-0000-0000-0000-000000000000', 'd1000001-0000-0000-0000-000000000003', 6900, 'succeeded', 'sepa_debit', '2029-12-01', 'in_th3');
-- N a écrit, sans réponse ; V a reçu une réponse.
insert into public.interactions (gym_id, member_id, channel, direction, summary, occurred_at) values
  ('da000001-0000-0000-0000-000000000000', 'd1000001-0000-0000-0000-000000000002', 'email', 'inbound', 'Question', '2029-12-02'),
  ('da000001-0000-0000-0000-000000000000', 'd1000001-0000-0000-0000-000000000003', 'whatsapp', 'inbound', 'Question', '2029-12-02'),
  ('da000001-0000-0000-0000-000000000000', 'd1000001-0000-0000-0000-000000000003', 'whatsapp', 'outbound', 'Réponse', '2029-12-03');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

-- Permanences
select pg_temp.login_as('d0000001-0000-0000-0000-000000000001');
select lives_ok($$insert into public.desk_shifts (gym_id, profile_id, starts_at, ends_at) values
  ('da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000003', '2030-01-15 06:00+00', '2030-01-15 11:00+00')$$,
  'gérant : affecte un coach à l''accueil');
select throws_ok($$insert into public.desk_shifts (gym_id, profile_id, starts_at, ends_at) values
  ('da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000005', '2030-01-15 11:00+00', '2030-01-15 15:00+00')$$,
  'P0001', 'not_team_member', 'un adhérent ne peut pas être de permanence');
select throws_ok($$insert into public.desk_shifts (gym_id, profile_id, starts_at, ends_at) values
  ('da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000002', '2030-01-15 11:00+00', '2030-01-15 10:00+00')$$,
  '23514', null, 'la fin suit le début');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000002');
select throws_ok($$insert into public.desk_shifts (gym_id, profile_id, starts_at, ends_at) values
  ('da000001-0000-0000-0000-000000000000', 'd0000001-0000-0000-0000-000000000002', '2030-01-15 11:00+00', '2030-01-15 15:00+00')$$,
  '42501', null, 'accueil : ne planifie pas les permanences');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000004');
select is((select count(*) from public.desk_shifts), 1::bigint, 'coach : voit les permanences');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000005');
select is((select count(*) from public.desk_shifts), 0::bigint, 'adhérent : ne voit pas les permanences');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000006');
select is((select count(*) from public.desk_shifts), 0::bigint, 'autre salle : ne voit pas les permanences');

-- Note « à savoir »
select pg_temp.login_as('d0000001-0000-0000-0000-000000000002');
select lives_ok($$insert into public.member_care_notes (member_id, gym_id, note) values
  ('d1000001-0000-0000-0000-000000000001', 'da000001-0000-0000-0000-000000000000', 'Genou fragile')$$,
  'accueil : écrit une note');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000003');
select is((select note from public.member_care_notes), 'Genou fragile', 'coach de la séance : lit la note');
with changed as (update public.member_care_notes set note = 'x' returning 1)
select is((select count(*) from changed), 0::bigint, 'coach : ne modifie pas la note');
select is((select note from public.member_care_notes), 'Genou fragile', 'la note est intacte');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000004');
select is((select count(*) from public.member_care_notes), 0::bigint, 'autre coach : ne lit pas la note');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000005');
select is((select count(*) from public.member_care_notes), 0::bigint, 'adhérent : ne lit aucune note');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000006');
select is((select count(*) from public.member_care_notes), 0::bigint, 'autre salle : ne lit pas la note');

-- Essais et nouveaux venus du jour
select pg_temp.login_as('d0000001-0000-0000-0000-000000000001');
select is(
  (select array_agg(first_name || ':' || visit_number || ':' || is_trial order by first_name)
   from public.today_trials('da000001-0000-0000-0000-000000000000', '2030-01-15')),
  array['Nina:2:false', 'Paul:1:true'], 'gérant : essai et 2e séance, pas l''habitué');
select is(
  (select note from public.today_trials('da000001-0000-0000-0000-000000000000', '2030-01-15') where first_name = 'Paul'),
  'Genou fragile', 'la note accompagne l''essai');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000003');
select is((select count(*) from public.today_trials('da000001-0000-0000-0000-000000000000', '2030-01-15')),
  2::bigint, 'coach de la séance : voit ses essais');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000004');
select is((select count(*) from public.today_trials('da000001-0000-0000-0000-000000000000', '2030-01-15')),
  0::bigint, 'autre coach : rien');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000005');
select throws_ok($$select * from public.today_trials('da000001-0000-0000-0000-000000000000', '2030-01-15')$$,
  'P0001', 'forbidden', 'adhérent : refusé');

-- CRM à compléter
select pg_temp.login_as('d0000001-0000-0000-0000-000000000001');
select is((select member_ids from public.crm_todo('da000001-0000-0000-0000-000000000000') where kind = 'incomplete'),
  array['d1000001-0000-0000-0000-000000000001'::uuid], 'fiche sans email à compléter');
select is((select member_ids from public.crm_todo('da000001-0000-0000-0000-000000000000') where kind = 'unanswered'),
  array['d1000001-0000-0000-0000-000000000002'::uuid], 'message sans réponse, pas celui qui a eu sa réponse');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000002');
select throws_ok($$select * from public.crm_todo('da000001-0000-0000-0000-000000000000')$$,
  'P0001', 'forbidden', 'accueil : CRM réservé au gérant');

-- Impayés
select pg_temp.login_as('d0000001-0000-0000-0000-000000000001');
select is(
  (select first_name || ':' || failures || ':' || amount_cents from public.unpaid_members('da000001-0000-0000-0000-000000000000')),
  'Nina:2:6900', 'deux échecs depuis le dernier paiement réussi');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000002');
select is((select count(*) from public.unpaid_members('da000001-0000-0000-0000-000000000000')),
  1::bigint, 'accueil : voit les impayés pour relancer et encaisser');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000006');
select throws_ok($$select * from public.unpaid_members('da000001-0000-0000-0000-000000000000')$$,
  'P0001', 'forbidden', 'autre salle : refusé');

-- Digest du jour
select pg_temp.login_as('d0000001-0000-0000-0000-000000000001');
select lives_ok($$insert into public.daily_digests (gym_id, day, content) values
  ('da000001-0000-0000-0000-000000000000', '2030-01-15', '{"brief": {"text": "x", "actions": []}}')$$,
  'gérant : enregistre le digest');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000002');
select is((select count(*) from public.daily_digests), 0::bigint, 'accueil : ne lit pas le digest');
select pg_temp.login_as('d0000001-0000-0000-0000-000000000006');
select is((select count(*) from public.daily_digests), 0::bigint, 'autre salle : ne lit pas le digest');

select pg_temp.logout();
select * from finish();
rollback;
