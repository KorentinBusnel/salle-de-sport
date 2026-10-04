-- Emailing : variables, campagne (consentement), programmation, automatisations, RLS.
begin;
select plan(19);

insert into auth.users (id, email) values
  ('70000000-0000-0000-0000-000000000001', 'e-un@test.local'),
  ('70000000-0000-0000-0000-000000000002', 'e-deux@test.local'),
  ('70000000-0000-0000-0000-000000000003', 'e-gerant@test.local'),
  ('70000000-0000-0000-0000-000000000004', 'e-accueil@test.local'),
  ('70000000-0000-0000-0000-000000000005', 'e-gerant-autre@test.local');
update public.profiles set birth_date = (now() at time zone 'Europe/Paris')::date - interval '30 years'
where id = '70000000-0000-0000-0000-000000000001';

insert into public.gyms (id, name, slug, timezone) values
  ('7a000000-0000-0000-0000-000000000000', 'Salle E', 'salle-e', 'Europe/Paris'),
  ('7b000000-0000-0000-0000-000000000000', 'Salle F', 'salle-f', 'Europe/Paris');
insert into public.gym_roles (gym_id, profile_id, role) values
  ('7a000000-0000-0000-0000-000000000000', '70000000-0000-0000-0000-000000000003', 'manager'),
  ('7a000000-0000-0000-0000-000000000000', '70000000-0000-0000-0000-000000000004', 'staff'),
  ('7b000000-0000-0000-0000-000000000000', '70000000-0000-0000-0000-000000000005', 'manager');

-- Un : consentement. Deux : sans consentement. Prospect : à activer.
insert into public.members (id, gym_id, profile_id, first_name, last_name, email, status, marketing_email_consent_at, created_at) values
  ('71000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000000', '70000000-0000-0000-0000-000000000001', 'Anna', 'E', 'anna@test.local', 'active', now(), now() - interval '90 days'),
  ('71000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000000', '70000000-0000-0000-0000-000000000002', 'Bruno', 'E', 'bruno@test.local', 'active', null, now() - interval '90 days'),
  ('71000000-0000-0000-0000-000000000003', '7a000000-0000-0000-0000-000000000000', null, 'Chloé', 'E', 'chloe@test.local', 'prospect', null, now());

insert into public.email_templates (id, gym_id, name, subject, body) values
  ('72000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000000', 'Relance', 'On vous attend, {prenom} !', 'Bonjour {prenom} {nom}, toute l''équipe de {salle} vous attend.'),
  ('72000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000000', 'Bienvenue', 'Bienvenue {prenom}', 'Bienvenue chez {salle}.');
insert into public.segments (id, gym_id, name, filters) values
  ('73000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000000', 'Actifs', '{"statuses": ["active"]}');
insert into public.campaigns (id, gym_id, name, channel, segment, content) values
  ('74000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000000', 'Relance', 'email',
   '{"segment_id": "73000000-0000-0000-0000-000000000001"}',
   '{"subject": "On vous attend, {prenom} !", "body": "Bonjour {prenom}, {salle} vous attend."}'),
  ('74000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000000', 'Programmée', 'email',
   '{"segment_id": "73000000-0000-0000-0000-000000000001"}',
   '{"subject": "Programmée", "body": "Bonjour {prenom}"}');
update public.campaigns set status = 'scheduled', scheduled_at = now() - interval '1 minute'
where id = '74000000-0000-0000-0000-000000000002';

create function pg_temp.login_as(p_user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;

select is(private.render_template('Bonjour {prenom} {nom}, {salle}', '71000000-0000-0000-0000-000000000001'),
  'Bonjour Anna E, Salle E', 'variables remplacées');

select pg_temp.login_as('70000000-0000-0000-0000-000000000003');
select is((select subject from public.preview_template('7a000000-0000-0000-0000-000000000000', 'Salut {prenom}', 'x')),
  'Salut Anna', 'aperçu sur un adhérent actif');
select is((select reachable from public.segment_audience('73000000-0000-0000-0000-000000000001')), 1,
  'audience : un seul joignable (consentement)');
select is((public.send_campaign('74000000-0000-0000-0000-000000000001')).stats,
  '{"targeted": 2, "excluded_no_consent": 1, "queued": 1}'::jsonb, 'campagne : consentement respecté');
select throws_ok($$select public.send_campaign('74000000-0000-0000-0000-000000000001')$$,
  'P0001', 'campaign_not_editable', 'campagne : pas de second envoi');
select pg_temp.logout();
select is((select subject from public.outbound_messages where origin = 'campaign' and member_id = '71000000-0000-0000-0000-000000000001'),
  'On vous attend, Anna !', 'message personnalisé mis en file');

select is(private.run_scheduled_campaigns(), 1, 'campagne programmée partie à l''heure');
select is((select status from public.campaigns where id = '74000000-0000-0000-0000-000000000002'),
  'sent'::public.campaign_status, 'campagne programmée : envoyée');

-- Automatisations
insert into public.automations (gym_id, kind, enabled, template_id, params) values
  ('7a000000-0000-0000-0000-000000000000', 'welcome', true, '72000000-0000-0000-0000-000000000002', '{}'),
  ('7a000000-0000-0000-0000-000000000000', 'inactive', true, '72000000-0000-0000-0000-000000000001', '{"days": 14}'),
  ('7a000000-0000-0000-0000-000000000000', 'birthday', true, '72000000-0000-0000-0000-000000000001', '{}');

select pg_temp.login_as('70000000-0000-0000-0000-000000000004');
select public.set_member_status('71000000-0000-0000-0000-000000000003', 'active');
select pg_temp.logout();
select is((select subject from public.outbound_messages where origin = 'automation' and member_id = '71000000-0000-0000-0000-000000000003'),
  'Bienvenue Chloé', 'bienvenue à l''activation');
update public.members set status = 'suspended' where id = '71000000-0000-0000-0000-000000000003';
update public.members set status = 'active' where id = '71000000-0000-0000-0000-000000000003';
select is((select count(*) from public.outbound_messages where origin = 'automation' and member_id = '71000000-0000-0000-0000-000000000003'),
  1::bigint, 'bienvenue : une seule fois (réactivation sans message)');

-- Anna : inactive (aucune séance, fiche de 90 j) et anniversaire, avec consentement. Bruno : sans consentement.
select is(private.run_automations(), 2, 'inactifs et anniversaire : messages mis en file');
select is(private.run_automations(), 0, 'idempotent : rien au second passage');
select is((select count(*) from public.outbound_messages where origin = 'automation' and member_id = '71000000-0000-0000-0000-000000000002'),
  0::bigint, 'marketing : pas de message sans consentement');
select isnt((select last_run_at from public.automations where kind = 'inactive' and gym_id = '7a000000-0000-0000-0000-000000000000'),
  null, 'date du dernier passage enregistrée');

-- RLS
select pg_temp.login_as('70000000-0000-0000-0000-000000000004');
select is((select count(*) from public.email_templates), 0::bigint, 'accueil : pas de modèles');
select throws_ok($$select public.send_campaign('74000000-0000-0000-0000-000000000001')$$,
  'P0001', 'forbidden', 'accueil : n''envoie pas de campagne');
select pg_temp.login_as('70000000-0000-0000-0000-000000000005');
select is((select count(*) from public.automations), 0::bigint, 'autre salle : pas d''automatisations');
select throws_ok($$select * from public.preview_template('7a000000-0000-0000-0000-000000000000', 'x', 'y')$$,
  'P0001', 'forbidden', 'autre salle : pas d''aperçu');
select pg_temp.login_as('70000000-0000-0000-0000-000000000001');
select is((select count(*) from public.email_templates), 0::bigint, 'adhérent : pas de modèles');
select pg_temp.logout();

select * from finish();
rollback;
