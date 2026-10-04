-- Stratégies configurables (gyms.settings) : chaque règle est testée désactivée (défaut)
-- puis activée. Données propres au test (salle S), indépendantes du seed.
begin;
select plan(43);

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-000000000001', 's-membre@test.local'),
  ('20000000-0000-0000-0000-000000000002', 's-autre@test.local'),
  ('20000000-0000-0000-0000-000000000003', 's-coach@test.local'),
  ('20000000-0000-0000-0000-000000000004', 's-accueil@test.local'),
  ('20000000-0000-0000-0000-000000000005', 's-gerant@test.local'),
  ('20000000-0000-0000-0000-000000000006', 's-gerant-t@test.local');

insert into public.gyms (id, name, slug, settings) values
  ('da000000-0000-0000-0000-000000000000', 'Salle S', 'salle-s', '{}'),
  ('db000000-0000-0000-0000-000000000000', 'Salle T', 'salle-t', '{}');

insert into public.gym_roles (gym_id, profile_id, role) values
  ('da000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000003', 'coach'),
  ('da000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000004', 'staff'),
  ('da000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000005', 'manager'),
  ('db000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000006', 'manager');

insert into public.members (id, gym_id, profile_id, first_name, last_name, email, phone, status) values
  ('d1000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'Mona', 'S', 'mona@test.local', '06 11 22 33 44', 'active'),
  ('d1000000-0000-0000-0000-000000000002', 'da000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'Paul', 'S', null, null, 'prospect');

insert into public.credit_ledger (gym_id, member_id, delta, reason) values
  ('da000000-0000-0000-0000-000000000000', 'd1000000-0000-0000-0000-000000000001', 3, 'purchase');

insert into public.disciplines (id, gym_id, name, color) values
  ('d4000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000000', 'CrossFit', '#dc2626');
insert into public.coaches (id, gym_id, profile_id, display_name) values
  ('d5000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000003', 'Coach S');

-- s1 : commencée il y a 5 min. s2 : dans 2 h. s3 : commencée il y a 5 min, complète (1 place).
insert into public.class_sessions (id, gym_id, discipline_id, coach_id, starts_at, ends_at, capacity) values
  ('d6000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000000', 'd4000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', now() - interval '5 minutes', now() + interval '55 minutes', 5),
  ('d6000000-0000-0000-0000-000000000002', 'da000000-0000-0000-0000-000000000000', 'd4000000-0000-0000-0000-000000000001', 'd5000000-0000-0000-0000-000000000001', now() + interval '2 hours', now() + interval '3 hours', 5),
  ('d6000000-0000-0000-0000-000000000003', 'da000000-0000-0000-0000-000000000000', 'd4000000-0000-0000-0000-000000000001', null, now() - interval '5 minutes', now() + interval '55 minutes', 1);

insert into public.bookings (id, gym_id, session_id, member_id, status) values
  ('d7000000-0000-0000-0000-000000000002', 'da000000-0000-0000-0000-000000000000', 'd6000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'confirmed'),
  ('d7000000-0000-0000-0000-000000000003', 'da000000-0000-0000-0000-000000000000', 'd6000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000002', 'confirmed');

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.set(p_settings jsonb) returns void language sql as $$
  update public.gyms set settings = settings || p_settings where id = 'da000000-0000-0000-0000-000000000000';
$$;

-- ---------------------------------------------------------------------------
-- Retardataires (late_booking_minutes)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('20000000-0000-0000-0000-000000000004');
select throws_ok($$select public.book_session('d6000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001')$$,
  'P0001', 'session_started', 'retard : refusé par défaut');
select pg_temp.logout();
select pg_temp.set('{"late_booking_minutes": 3}');
select pg_temp.login_as('20000000-0000-0000-0000-000000000004');
select throws_ok($$select public.book_session('d6000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001')$$,
  'P0001', 'session_started', 'retard : refusé au-delà de la tolérance');
select pg_temp.logout();
select pg_temp.set('{"late_booking_minutes": 10}');
select pg_temp.login_as('20000000-0000-0000-0000-000000000001');
select throws_ok($$select public.book_session('d6000000-0000-0000-0000-000000000001')$$,
  'P0001', 'session_started', 'retard : l''adhérent ne s''inscrit pas lui-même');
select pg_temp.login_as('20000000-0000-0000-0000-000000000004');
select is((public.book_session('d6000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001')).status,
  'confirmed', 'retard : l''accueil inscrit dans la tolérance');
select throws_ok($$select public.book_session('d6000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001')$$,
  'P0001', 'session_full', 'retard : pas de liste d''attente sur une séance commencée');
select pg_temp.logout();
select is(private.credit_balance('d1000000-0000-0000-0000-000000000001'), 2, 'retard : crédit débité');

-- ---------------------------------------------------------------------------
-- Fenêtre de pointage (attendance_opens_minutes_before)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('20000000-0000-0000-0000-000000000003');
select is((public.set_attendance('d7000000-0000-0000-0000-000000000002', 'attended')).status,
  'attended', 'pointage : sans limite par défaut');
select pg_temp.logout();
update public.bookings set status = 'confirmed', checked_in_at = null where id = 'd7000000-0000-0000-0000-000000000002';
select pg_temp.set('{"attendance_opens_minutes_before": 30}');
select pg_temp.login_as('20000000-0000-0000-0000-000000000003');
select throws_ok($$select public.set_attendance('d7000000-0000-0000-0000-000000000002', 'attended')$$,
  'P0001', 'attendance_not_open', 'pointage : refusé avant l''ouverture');
select pg_temp.login_as('20000000-0000-0000-0000-000000000004');
select is((public.set_attendance('d7000000-0000-0000-0000-000000000003', 'no_show')).status,
  'no_show', 'pointage : accueil : accepté une fois la séance commencée');
select pg_temp.logout();
select pg_temp.set('{"attendance_opens_minutes_before": 180}');
select pg_temp.login_as('20000000-0000-0000-0000-000000000003');
select is((public.set_attendance('d7000000-0000-0000-0000-000000000002', 'attended')).status,
  'attended', 'pointage : accepté dans la fenêtre');

-- ---------------------------------------------------------------------------
-- Remise à « confirmé » (allow_attendance_reset)
-- ---------------------------------------------------------------------------
select throws_ok($$select public.reset_attendance('d7000000-0000-0000-0000-000000000002')$$,
  'P0001', 'strategy_disabled', 'remise à confirmé : désactivée par défaut');
select pg_temp.logout();
select pg_temp.set('{"allow_attendance_reset": true}');
select pg_temp.login_as('20000000-0000-0000-0000-000000000001');
select throws_ok($$select public.reset_attendance('d7000000-0000-0000-0000-000000000002')$$,
  'P0001', 'forbidden', 'remise à confirmé : pas par l''adhérent');
select pg_temp.login_as('20000000-0000-0000-0000-000000000003');
select is((public.reset_attendance('d7000000-0000-0000-0000-000000000002')).status,
  'confirmed', 'remise à confirmé : par le coach une fois activée');
select is((select checked_in_at from public.bookings where id = 'd7000000-0000-0000-0000-000000000002'),
  null, 'remise à confirmé : heure d''arrivée effacée');
select throws_ok($$select public.reset_attendance('d7000000-0000-0000-0000-000000000002')$$,
  'P0001', 'not_attendable', 'remise à confirmé : seulement après un pointage');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Crédits (manager_can_remove_credits)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('20000000-0000-0000-0000-000000000004');
select throws_ok($$select public.adjust_credits('d1000000-0000-0000-0000-000000000001', 2)$$,
  'P0001', 'forbidden', 'crédits : l''accueil n''ajoute pas');
select throws_ok($$insert into public.credit_ledger (gym_id, member_id, delta, reason, created_by) values
  ('da000000-0000-0000-0000-000000000000', 'd1000000-0000-0000-0000-000000000001', 5, 'manual_adjustment', '20000000-0000-0000-0000-000000000004')$$,
  '42501', null, 'crédits : pas d''écriture directe dans le registre');
select pg_temp.login_as('20000000-0000-0000-0000-000000000006');
select throws_ok($$select public.adjust_credits('d1000000-0000-0000-0000-000000000001', 2)$$,
  'P0001', 'forbidden', 'crédits : un gérant d''une autre salle n''ajoute pas');
select pg_temp.login_as('20000000-0000-0000-0000-000000000005');
select is(public.adjust_credits('d1000000-0000-0000-0000-000000000001', 2), 4, 'crédits : le gérant ajoute');
select throws_ok($$select public.adjust_credits('d1000000-0000-0000-0000-000000000001', 0)$$,
  'P0001', 'invalid_amount', 'crédits : montant nul refusé');
select throws_ok($$select public.adjust_credits('d1000000-0000-0000-0000-000000000001', -1, 'Erreur de saisie')$$,
  'P0001', 'strategy_disabled', 'crédits : retrait désactivé par défaut');
select pg_temp.logout();
select pg_temp.set('{"manager_can_remove_credits": true}');
select pg_temp.login_as('20000000-0000-0000-0000-000000000005');
select throws_ok($$select public.adjust_credits('d1000000-0000-0000-0000-000000000001', -1, '  ')$$,
  'P0001', 'reason_required', 'crédits : motif obligatoire pour un retrait');
select throws_ok($$select public.adjust_credits('d1000000-0000-0000-0000-000000000001', -5, 'Erreur')$$,
  'P0001', 'insufficient_credits', 'crédits : pas de solde négatif');
select is(public.adjust_credits('d1000000-0000-0000-0000-000000000001', -1, 'Erreur de saisie'), 3,
  'crédits : retrait avec motif une fois activé');
select pg_temp.logout();
select is((select note from public.credit_ledger where member_id = 'd1000000-0000-0000-0000-000000000001' and reason = 'manual_adjustment' and delta = -1),
  'Erreur de saisie', 'crédits : motif enregistré');

-- ---------------------------------------------------------------------------
-- Statut des fiches (staff_can_suspend_members)
-- ---------------------------------------------------------------------------
select pg_temp.login_as('20000000-0000-0000-0000-000000000004');
select throws_ok($$update public.members set status = 'suspended' where id = 'd1000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'statut : pas de modification directe');
select lives_ok($$update public.members set phone = '07 00 00 00 00' where id = 'd1000000-0000-0000-0000-000000000002'$$,
  'fiche : l''accueil modifie encore les coordonnées');
select is((public.set_member_status('d1000000-0000-0000-0000-000000000002', 'active')).status,
  'active', 'statut : l''accueil active un prospect');
select throws_ok($$select public.set_member_status('d1000000-0000-0000-0000-000000000002', 'suspended')$$,
  'P0001', 'strategy_disabled', 'statut : l''accueil ne suspend pas par défaut');
select throws_ok($$select public.set_member_status('d1000000-0000-0000-0000-000000000002', 'cancelled')$$,
  'P0001', 'forbidden', 'statut : l''accueil ne résilie pas');
select throws_ok($$select public.set_member_status('d1000000-0000-0000-0000-000000000002', 'active')$$,
  'P0001', 'invalid_transition', 'statut : transition identique refusée');
select pg_temp.login_as('20000000-0000-0000-0000-000000000001');
select throws_ok($$select public.set_member_status('d1000000-0000-0000-0000-000000000001', 'suspended')$$,
  'P0001', 'forbidden', 'statut : un adhérent ne change pas son statut');
select pg_temp.login_as('20000000-0000-0000-0000-000000000005');
select is((public.set_member_status('d1000000-0000-0000-0000-000000000002', 'suspended')).status,
  'suspended', 'statut : le gérant suspend');
select pg_temp.logout();
select pg_temp.set('{"staff_can_suspend_members": true}');
select pg_temp.login_as('20000000-0000-0000-0000-000000000004');
select is((public.set_member_status('d1000000-0000-0000-0000-000000000002', 'active')).status,
  'active', 'statut : l''accueil réactive une fois activé');
select is((public.set_member_status('d1000000-0000-0000-0000-000000000002', 'suspended')).status,
  'suspended', 'statut : l''accueil suspend une fois activé');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- Création de fiches (staff_can_create_members) et doublons
-- ---------------------------------------------------------------------------
select pg_temp.login_as('20000000-0000-0000-0000-000000000004');
select throws_ok($$select public.create_member('da000000-0000-0000-0000-000000000000', 'Léa', 'N')$$,
  'P0001', 'strategy_disabled', 'création : l''accueil ne crée pas par défaut');
select pg_temp.login_as('20000000-0000-0000-0000-000000000006');
select throws_ok($$select public.create_member('da000000-0000-0000-0000-000000000000', 'Léa', 'N')$$,
  'P0001', 'forbidden', 'création : pas dans une autre salle');
select pg_temp.login_as('20000000-0000-0000-0000-000000000005');
select is((public.create_member('da000000-0000-0000-0000-000000000000', ' Léa ', 'N', 'Lea@Test.local', null, 'active')).email,
  'lea@test.local', 'création : le gérant crée une fiche (email normalisé)');
select throws_ok($$select public.create_member('da000000-0000-0000-0000-000000000000', '', 'N')$$,
  'P0001', 'invalid_input', 'création : nom obligatoire');
select pg_temp.logout();
select pg_temp.set('{"staff_can_create_members": true}');
select pg_temp.login_as('20000000-0000-0000-0000-000000000004');
select throws_ok($$select public.create_member('da000000-0000-0000-0000-000000000000', 'Mona', 'Bis', null, '+33 6 11 22 33 44')$$,
  'P0001', 'duplicate_member', 'création : doublon détecté par le téléphone');
select is((select count(*) from public.find_member_duplicates('da000000-0000-0000-0000-000000000000', 'MONA@test.local', null)),
  1::bigint, 'doublons : retrouvés par email');
select is((public.create_member('da000000-0000-0000-0000-000000000000', 'Mona', 'Bis', null, '+33 6 11 22 33 44', 'prospect', true)).status,
  'prospect', 'création : doublon confirmé par l''accueil une fois activé');
select pg_temp.login_as('20000000-0000-0000-0000-000000000006');
select is((select count(*) from public.find_member_duplicates('da000000-0000-0000-0000-000000000000', 'mona@test.local', null)),
  0::bigint, 'doublons : invisibles pour une autre salle');
select pg_temp.logout();

select * from finish();
rollback;
