-- Données de démo (BRIEF §10.7) : une salle, 4 disciplines, 6 coachs, 150 adhérents,
-- 3 mois d'historique de réservations et de paiements, 2 semaines de planning à venir.
--
-- Déterministe : tout l'aléatoire passe par pg_temp.rnd(), dérivé d'un hash de clés
-- stables. Les dates sont relatives au jour du `supabase db reset`.
--
-- Comptes de démo (mot de passe commun : demo1234) :
--   gerant@demo.local   gérant (manager)
--   admin@demo.local    admin
--   accueil@demo.local  accueil (staff)
--   coach1@demo.local … coach6@demo.local
--   adherent@demo.local adhérent actif, abonnement illimité
--   les autres adhérents : adresse visible dans public.members, même mot de passe
--
-- Les offres, prix et règles ci-dessous sont des exemples : les vraies offres
-- seront fixées en phase 2 (BRIEF §11).

-- ---------------------------------------------------------------------------
-- Outils
-- ---------------------------------------------------------------------------

-- Nombre pseudo-aléatoire stable dans [0, 1) dérivé des clés.
create function pg_temp.rnd(variadic k text[]) returns double precision
language sql immutable as $$
  select ('x' || substr(md5(array_to_string(k, '|')), 1, 8))::bit(32)::bigint / 4294967296.0
$$;

-- Élément d'un tableau choisi de façon stable.
create function pg_temp.pick(arr text[], variadic k text[]) returns text
language sql immutable as $$
  select arr[1 + floor(pg_temp.rnd(variadic k) * array_length(arr, 1))::int]
$$;

-- Identifiant stable (même UUID à chaque reset).
create function pg_temp.sid(k text) returns uuid
language sql immutable as $$
  select md5('seed:' || k)::uuid
$$;

create function pg_temp.slugify(t text) returns text
language sql immutable as $$
  select translate(lower(t), 'éèêëàâäîïôöùûüç ''', 'eeeeaaaiioouuuc--')
$$;

-- ---------------------------------------------------------------------------
-- Salle, disciplines, salles de cours
-- ---------------------------------------------------------------------------

insert into public.gyms (id, name, slug, address, timezone) values
  (pg_temp.sid('gym'), 'Atlas Training Club', 'atlas', '12 quai des Docks, 69009 Lyon', 'Europe/Paris');

insert into public.disciplines (id, gym_id, name, color, description) values
  (pg_temp.sid('d:crossfit'), pg_temp.sid('gym'), 'CrossFit', '#dc2626', 'WOD en groupe : haltérophilie, gymnastique, cardio.'),
  (pg_temp.sid('d:hyrox'), pg_temp.sid('gym'), 'Hyrox', '#f59e0b', 'Préparation aux courses Hyrox : 8 × 1 km et stations.'),
  (pg_temp.sid('d:renfo'), pg_temp.sid('gym'), 'Renfo', '#2563eb', 'Renforcement musculaire et gainage, tous niveaux.'),
  (pg_temp.sid('d:run'), pg_temp.sid('gym'), 'Run', '#16a34a', 'Running club : fractionné en semaine, sortie longue le dimanche.');

insert into public.rooms (id, gym_id, name, capacity) values
  (pg_temp.sid('r:box'), pg_temp.sid('gym'), 'Box', 16),
  (pg_temp.sid('r:studio'), pg_temp.sid('gym'), 'Studio', 14),
  (pg_temp.sid('r:ext'), pg_temp.sid('gym'), 'Extérieur', 30);

-- ---------------------------------------------------------------------------
-- Personnes : équipe, coachs, adhérents
-- ---------------------------------------------------------------------------

create temp table seed_members as
with names as (
  select
    array['Camille','Léa','Manon','Chloé','Emma','Inès','Sarah','Julie','Lucie','Clara',
          'Marie','Pauline','Laura','Anaïs','Mathilde','Océane','Justine','Élise','Margaux','Juliette',
          'Alice','Charlotte','Zoé','Louise','Jade','Lina','Nina','Salomé','Romane','Agathe',
          'Thomas','Lucas','Hugo','Nathan','Maxime','Antoine','Julien','Romain','Alexandre','Nicolas',
          'Kévin','Quentin','Mathieu','Baptiste','Clément','Pierre','Louis','Arthur','Théo','Paul',
          'Adrien','Florian','Valentin','Samuel','Yanis','Mehdi','Karim','Sofiane','Jules','Victor'] as firsts,
    array['Martin','Bernard','Dubois','Thomas','Robert','Richard','Petit','Durand','Leroy','Moreau',
          'Simon','Laurent','Lefebvre','Michel','Garcia','David','Bertrand','Roux','Vincent','Fournier',
          'Morel','Girard','André','Lefèvre','Mercier','Dupont','Lambert','Bonnet','François','Martinez',
          'Legrand','Garnier','Faure','Rousseau','Blanc','Guérin','Muller','Henry','Roussel','Nicolas',
          'Perrin','Morin','Mathieu','Clément','Gauthier','Dumont','Lopez','Fontaine','Chevalier','Robin',
          'Masson','Sanchez','Gérard','Nguyen','Boyer','Denis','Lemaire','Duval','Joly','Benali'] as lasts
),
base as (
  select
    n,
    case when n = 1 then 'Camille' else pg_temp.pick(firsts, 'first', n::text) end as first_name,
    case when n = 1 then 'Martin' else pg_temp.pick(lasts, 'last', n::text) end as last_name,
    -- 1-110 actifs, 111-120 suspendus (impayé), 121-135 résiliés, 136-150 prospects.
    case
      when n <= 110 then 'active'
      when n <= 120 then 'suspended'
      when n <= 135 then 'cancelled'
      else 'prospect'
    end::public.member_status as status
  from generate_series(1, 150) as n, names
)
select
  n,
  pg_temp.sid('m:' || n) as id,
  case when status <> 'prospect' then pg_temp.sid('u:m:' || n) end as user_id,
  first_name,
  last_name,
  case
    when n = 1 then 'adherent@demo.local'
    else pg_temp.slugify(first_name) || '.' || pg_temp.slugify(last_name) || n || '@example.com'
  end as email,
  '+33 6 ' || to_char(floor(pg_temp.rnd('phone', n::text) * 1e8)::int, 'FM00 00 00 00') as phone,
  (date '1975-01-01' + floor(pg_temp.rnd('birth', n::text) * 10950)::int) as birth_date,
  status,
  case
    when status = 'prospect' then now() - make_interval(days => floor(pg_temp.rnd('created', n::text) * 45)::int)
    when status = 'cancelled' then now() - make_interval(days => 120 + floor(pg_temp.rnd('created', n::text) * 600)::int)
    -- Un quart des actifs a rejoint la salle pendant les 3 derniers mois.
    when pg_temp.rnd('recent', n::text) < 0.25 then now() - make_interval(days => 3 + floor(pg_temp.rnd('created', n::text) * 85)::int)
    else now() - make_interval(days => 95 + floor(pg_temp.rnd('created', n::text) * 640)::int)
  end as created_at,
  case
    when status = 'cancelled' then now() - make_interval(days => 5 + floor(pg_temp.rnd('cancel', n::text) * 80)::int)
  end as canceled_at,
  -- Abonnement récurrent pour 3 actifs sur 4, carnet pour les autres.
  case
    when status = 'prospect' then null
    when status = 'active' and n % 4 = 0 then 'pack'
    when n = 1 then 'unlimited_12'
    when pg_temp.rnd('plan', n::text) < 0.55 then 'unlimited_12'
    when pg_temp.rnd('plan', n::text) < 0.85 then 'unlimited'
    else 'student'
  end as plan_key,
  -- Assiduité relative (pondère le nombre de réservations).
  0.3 + 0.7 * pg_temp.rnd('assiduity', n::text) as assiduity,
  -- Adhérents actifs qui ne réservent plus depuis 3 semaines (cas « qui risque de partir ? »).
  (status = 'active' and n > 1 and pg_temp.rnd('dormant', n::text) < 0.1) as dormant
from base;

create temp table seed_staff (key text, email text, first_name text, last_name text, role public.gym_role);
insert into seed_staff values
  ('gerant', 'gerant@demo.local', 'Nadia', 'Lambert', 'manager'),
  ('admin', 'admin@demo.local', 'Olivier', 'Mercier', 'admin'),
  ('accueil', 'accueil@demo.local', 'Emma', 'Rousseau', 'staff');

create temp table seed_coaches (
  key text, email text, first_name text, last_name text, disciplines text[],
  employment public.employment_type, rate_cents int, bio text
);
insert into seed_coaches values
  ('c1', 'coach1@demo.local', 'Julien', 'Morel', array['crossfit','hyrox'], 'employee', 2400, 'CrossFit L2, ancien rugbyman.'),
  ('c2', 'coach2@demo.local', 'Sarah', 'Benali', array['crossfit','renfo'], 'employee', 2400, 'Spécialiste haltérophilie et mobilité.'),
  ('c3', 'coach3@demo.local', 'Maxime', 'Roux', array['hyrox','run'], 'freelance', 3800, 'Finisher Hyrox Elite 15, coach running.'),
  ('c4', 'coach4@demo.local', 'Inès', 'Garnier', array['renfo','run'], 'freelance', 3500, 'Préparatrice physique, marathonienne.'),
  ('c5', 'coach5@demo.local', 'Thomas', 'Faure', array['crossfit'], 'freelance', 3500, 'Coach CrossFit, créneaux du matin.'),
  ('c6', 'coach6@demo.local', 'Clara', 'Duval', array['renfo','crossfit'], 'employee', 2200, 'Renforcement, prévention des blessures.');

-- Comptes d'authentification (mot de passe : demo1234), hachage calculé une seule fois.
create temp table seed_users as
select pg_temp.sid('u:staff:' || key) as id, email, first_name, last_name from seed_staff
union all
select pg_temp.sid('u:coach:' || key), email, first_name, last_name from seed_coaches
union all
select user_id, email, first_name, last_name from seed_members where user_id is not null;

with pw as (select extensions.crypt('demo1234', extensions.gen_salt('bf')) as hash)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, pw.hash, now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('first_name', u.first_name, 'last_name', u.last_name),
  now(), now(), '', '', '', ''
from seed_users u, pw;

insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  now(), now(), now()
from seed_users;

-- Les profils sont créés par le trigger on_auth_user_created ; on complète les adhérents.
update public.profiles p
set phone = m.phone, birth_date = m.birth_date
from seed_members m
where p.id = m.user_id;

insert into public.gym_roles (gym_id, profile_id, role)
select pg_temp.sid('gym'), pg_temp.sid('u:staff:' || key), role from seed_staff
union all
select pg_temp.sid('gym'), pg_temp.sid('u:coach:' || key), 'coach' from seed_coaches
union all
select pg_temp.sid('gym'), user_id, 'member' from seed_members where user_id is not null;

insert into public.coaches (id, gym_id, profile_id, display_name, bio)
select pg_temp.sid('c:' || key), pg_temp.sid('gym'), pg_temp.sid('u:coach:' || key), first_name || ' ' || left(last_name, 1) || '.', bio
from seed_coaches;

insert into public.coach_disciplines (gym_id, coach_id, discipline_id)
select pg_temp.sid('gym'), pg_temp.sid('c:' || key), pg_temp.sid('d:' || d)
from seed_coaches, unnest(disciplines) as d;

insert into public.coach_compensations (coach_id, gym_id, employment_type, hourly_rate_cents)
select pg_temp.sid('c:' || key), pg_temp.sid('gym'), employment, rate_cents from seed_coaches;

insert into public.members (
  id, gym_id, profile_id, first_name, last_name, email, phone, status, acquisition_source, tags,
  marketing_email_consent_at, marketing_whatsapp_consent_at, created_at, updated_at
)
select
  id, pg_temp.sid('gym'), user_id, first_name, last_name, email, phone, status,
  pg_temp.pick(array['instagram','bouche-à-oreille','google','site web','passage','bsport'], 'source', n::text),
  array_remove(array[
    case when plan_key = 'student' then 'étudiant' end,
    case when pg_temp.rnd('tag-compet', n::text) < 0.12 then 'compétition' end,
    case when pg_temp.rnd('tag-blessure', n::text) < 0.06 then 'blessure' end
  ], null),
  case when pg_temp.rnd('consent-email', n::text) < 0.6 then created_at end,
  case when pg_temp.rnd('consent-wa', n::text) < 0.35 then created_at end,
  created_at, coalesce(canceled_at, created_at)
from seed_members;

-- ---------------------------------------------------------------------------
-- Offres (exemples)
-- ---------------------------------------------------------------------------

insert into public.plans (id, gym_id, name, description, type, price_cents, billing_interval, commitment_months, credits, validity_days) values
  (pg_temp.sid('p:unlimited_12'), pg_temp.sid('gym'), 'Illimité 12 mois', 'Accès illimité à tous les cours, engagement 12 mois.', 'recurring', 7900, 'month', 12, null, null),
  (pg_temp.sid('p:unlimited'), pg_temp.sid('gym'), 'Illimité sans engagement', 'Accès illimité à tous les cours, résiliable chaque mois.', 'recurring', 9900, 'month', null, null, null),
  (pg_temp.sid('p:student'), pg_temp.sid('gym'), 'Étudiant', 'Accès illimité sur justificatif, engagement 6 mois.', 'recurring', 5900, 'month', 6, null, null),
  (pg_temp.sid('p:pack'), pg_temp.sid('gym'), 'Carnet 10 séances', '10 séances valables 4 mois.', 'pack', 18000, null, null, 10, 120),
  (pg_temp.sid('p:single'), pg_temp.sid('gym'), 'Séance découverte', 'Une séance d''essai.', 'single', 1500, null, null, 1, 30);

insert into public.plan_disciplines (gym_id, plan_id, discipline_id)
select pg_temp.sid('gym'), pg_temp.sid('p:' || p), d.id
from unnest(array['unlimited_12','unlimited','student','pack','single']) as p
cross join public.disciplines d
where d.gym_id = pg_temp.sid('gym');

-- ---------------------------------------------------------------------------
-- Planning : modèles hebdomadaires, puis séances de J-91 à J+13
-- ---------------------------------------------------------------------------

-- popularity : taux de remplissage moyen du créneau.
create temp table seed_templates (
  key text, discipline text, coach text, alt_coach text, room text,
  weekdays int[], start_time time, duration int, capacity int, popularity numeric
);
insert into seed_templates values
  ('cf-0700', 'crossfit', 'c5', 'c6', 'box', array[1,2,3,4,5], '07:00', 60, 16, 0.60),
  ('cf-1215', 'crossfit', 'c2', 'c5', 'box', array[1,2,3,4,5], '12:15', 60, 16, 0.75),
  ('cf-1830', 'crossfit', 'c1', 'c2', 'box', array[1,2,3,4,5], '18:30', 60, 16, 0.95),
  ('cf-sat', 'crossfit', 'c6', 'c1', 'box', array[6], '10:00', 60, 16, 0.90),
  ('hy-1930', 'hyrox', 'c3', 'c1', 'box', array[2,4], '19:30', 75, 12, 0.85),
  ('hy-sat', 'hyrox', 'c1', 'c3', 'box', array[6], '11:15', 75, 12, 0.80),
  ('re-1215', 'renfo', 'c4', 'c6', 'studio', array[1,3,5], '12:15', 45, 14, 0.65),
  ('re-1930', 'renfo', 'c6', 'c2', 'studio', array[1,3], '19:30', 60, 14, 0.80),
  ('re-sat', 'renfo', 'c2', 'c4', 'studio', array[6], '09:00', 45, 14, 0.70),
  ('run-wed', 'run', 'c3', 'c4', 'ext', array[3], '19:00', 60, 25, 0.45),
  ('run-sun', 'run', 'c4', 'c3', 'ext', array[7], '09:30', 75, 25, 0.55);

insert into public.class_templates (
  id, gym_id, discipline_id, default_coach_id, room_id, weekday, start_time, duration_minutes, capacity, starts_on
)
select
  pg_temp.sid('t:' || key || ':' || wd), pg_temp.sid('gym'), pg_temp.sid('d:' || discipline),
  pg_temp.sid('c:' || coach), pg_temp.sid('r:' || room), wd, start_time, duration, capacity,
  current_date - 120
from seed_templates, unnest(weekdays) as wd;

create temp table seed_sessions as
select
  pg_temp.sid('s:' || t.key || ':' || d::date) as id,
  pg_temp.sid('t:' || t.key || ':' || extract(isodow from d)::int) as template_id,
  t.key as template_key,
  t.discipline,
  t.coach as default_coach,
  case when pg_temp.rnd('replace', t.key, d::date::text) < 0.04 then t.alt_coach else t.coach end as coach,
  t.room,
  (d::date + t.start_time) at time zone 'Europe/Paris' as starts_at,
  (d::date + t.start_time + make_interval(mins => t.duration)) at time zone 'Europe/Paris' as ends_at,
  t.capacity,
  pg_temp.rnd('cancelled', t.key, d::date::text) < 0.02 as cancelled,
  -- Demande du créneau ce jour-là (peut dépasser la capacité : liste d'attente).
  round(t.capacity * t.popularity * (0.75 + 0.45 * pg_temp.rnd('fill', t.key, d::date::text)))::int as demand
from seed_templates t
cross join generate_series(current_date - 91, current_date + 13, interval '1 day') as d
where extract(isodow from d)::int = any (t.weekdays);

insert into public.class_sessions (
  id, gym_id, template_id, discipline_id, coach_id, room_id, starts_at, ends_at, capacity, status, cancellation_reason
)
select
  id, pg_temp.sid('gym'), template_id, pg_temp.sid('d:' || discipline), pg_temp.sid('c:' || coach),
  pg_temp.sid('r:' || room), starts_at, ends_at, capacity,
  case when cancelled then 'cancelled' else 'scheduled' end::public.session_status,
  case when cancelled then 'Coach indisponible' end
from seed_sessions;

-- ---------------------------------------------------------------------------
-- Réservations
-- ---------------------------------------------------------------------------

-- Candidats par séance, classés par tirage pondéré (Efraimidis–Spirakis) :
-- assiduité de l'adhérent × appétence pour la discipline.
create temp table seed_bookings as
with eligible as (
  select
    s.id as session_id, s.starts_at, s.capacity, s.cancelled,
    -- Les réservations arrivent au fil de l'eau : une séance lointaine est moins remplie.
    case
      -- Créneaux phares de la semaine à venir : complets, avec liste d'attente.
      when s.starts_at > now() and s.starts_at < now() + interval '7 days'
        and s.template_key in ('cf-1830', 'hy-1930')
        then s.capacity + 1 + floor(pg_temp.rnd('waitlist', s.id::text) * 3)::int
      when s.starts_at > now()
        then floor(s.demand * least(1.1, greatest(0.15, 1.25 - extract(epoch from s.starts_at - now()) / 86400 / 10)))::int
      else s.demand
    end as demand,
    m.id as member_id, m.n,
    row_number() over (
      partition by s.id
      order by power(
        pg_temp.rnd('pick', s.id::text, m.n::text),
        1 / (m.assiduity * (case when pg_temp.rnd('likes', m.n::text, s.discipline) < 0.35 then 0.08 else 0.4 + pg_temp.rnd('likes', m.n::text, s.discipline) end))
      ) desc
    ) as rank
  from seed_sessions s
  join seed_members m
    on m.status <> 'prospect'
   and m.created_at < s.starts_at - interval '1 day'
   and (m.canceled_at is null or s.starts_at < m.canceled_at)
   and not (m.dormant and s.starts_at > now() - interval '21 days')
   -- Suspendus pour impayé depuis une dizaine de jours.
   and not (m.status = 'suspended' and s.starts_at > now() - interval '10 days')
   and not (m.plan_key = 'pack' and pg_temp.rnd('pack-skip', s.id::text, m.n::text) < 0.5)
)
select
  pg_temp.sid('b:' || session_id || ':' || n) as id,
  session_id, member_id, n, starts_at, rank,
  case
    when rank > capacity then 'waitlisted'
    when cancelled then 'cancelled'
    when starts_at > now() then
      case when pg_temp.rnd('fut-cancel', session_id::text, n::text) < 0.04 then 'cancelled' else 'confirmed' end
    when pg_temp.rnd('outcome', session_id::text, n::text) < 0.05 then 'cancelled'
    when pg_temp.rnd('outcome', session_id::text, n::text) < 0.11 then 'no_show'
    else 'attended'
  end::public.booking_status as status,
  least(
    now() - interval '5 minutes',
    starts_at - make_interval(hours => 2 + floor(pg_temp.rnd('booked', session_id::text, n::text) * 96)::int)
  ) as booked_at
from eligible
-- Liste d'attente seulement sur les séances à venir, 3 personnes au plus.
where rank <= least(demand, capacity)
   or (rank <= least(demand, capacity + 3) and starts_at > now() and not cancelled);

-- Règle de la salle : au plus 5 réservations à venir par adhérent (confirmées + attente).
-- Le compte de démo n'en garde que 2, pour pouvoir réserver dans l'app.
delete from seed_bookings
where id in (
  select id from (
    select b.id, b.n,
      row_number() over (partition by b.member_id order by b.starts_at, b.session_id) as upcoming_rank
    from seed_bookings b
    where b.starts_at > now() and b.status in ('confirmed', 'waitlisted')
  ) as upcoming
  where upcoming_rank > case when n = 1 then 2 else 5 end
);

-- Après ce retrait, les places libérées reviennent aux suivants : statut et position
-- d'attente recalculés séance par séance, dans l'ordre du tirage.
alter table seed_bookings add column slot integer;
update seed_bookings b
set slot = ranked.slot,
    status = case when ranked.slot <= ranked.capacity then 'confirmed' else 'waitlisted' end::public.booking_status
from (
  select sb.id, s.capacity, row_number() over (partition by sb.session_id order by sb.rank) as slot
  from seed_bookings sb
  join seed_sessions s on s.id = sb.session_id
  where sb.starts_at > now() and sb.status in ('confirmed', 'waitlisted')
) as ranked
where b.id = ranked.id;

insert into public.bookings (
  id, gym_id, session_id, member_id, status, waitlist_position, booked_at, cancelled_at, checked_in_at, created_at
)
select
  b.id, pg_temp.sid('gym'), b.session_id, b.member_id, b.status,
  case when b.status = 'waitlisted' then (b.slot - s.capacity)::int end,
  b.booked_at,
  case when b.status = 'cancelled' then least(now() - interval '1 minute', b.starts_at - interval '3 hours') end,
  case when b.status = 'attended' then b.starts_at - interval '5 minutes' end,
  b.booked_at
from seed_bookings b
join seed_sessions s on s.id = b.session_id;

-- ---------------------------------------------------------------------------
-- Abonnements et paiements récurrents (3 derniers mois)
-- ---------------------------------------------------------------------------

insert into public.subscriptions (
  id, gym_id, member_id, plan_id, status, started_at, current_period_start, current_period_end,
  commitment_ends_at, canceled_at, created_at
)
select
  pg_temp.sid('sub:' || m.n), pg_temp.sid('gym'), m.id, pg_temp.sid('p:' || m.plan_key),
  case m.status
    when 'active' then 'active'
    when 'suspended' then 'past_due'
    else 'canceled'
  end::public.subscription_status,
  m.created_at,
  period.start_at,
  period.start_at + interval '1 month',
  case m.plan_key
    when 'unlimited_12' then m.created_at + interval '12 months'
    when 'student' then m.created_at + interval '6 months'
  end,
  m.canceled_at,
  m.created_at
from seed_members m
cross join lateral (
  select m.created_at + make_interval(months => floor(
    (extract(year from age(coalesce(m.canceled_at, now()), m.created_at)) * 12
      + extract(month from age(coalesce(m.canceled_at, now()), m.created_at)))
  )::int) as start_at
) as period
where m.plan_key in ('unlimited_12', 'unlimited', 'student');

-- Une échéance par mois ; la dernière échéance des adhérents suspendus a échoué.
insert into public.payments (id, gym_id, member_id, amount_cents, status, method, description, paid_at, created_at)
select
  pg_temp.sid('pay:' || m.n || ':' || due),
  pg_temp.sid('gym'), m.id, p.price_cents,
  case
    when m.status = 'suspended' and due = max(due) over (partition by m.n) then 'failed'
    else 'succeeded'
  end::public.payment_status,
  case when pg_temp.rnd('method', m.n::text) < 0.4 then 'sepa_debit' else 'card' end::public.payment_method,
  p.name || ' — ' || (array['janvier','février','mars','avril','mai','juin','juillet','août',
    'septembre','octobre','novembre','décembre'])[extract(month from due at time zone 'Europe/Paris')::int]
    || ' ' || extract(year from due at time zone 'Europe/Paris'),
  case
    when m.status = 'suspended' and due = max(due) over (partition by m.n) then null
    else due
  end,
  due
from seed_members m
join public.plans p on p.id = pg_temp.sid('p:' || m.plan_key)
cross join lateral generate_series(m.created_at, coalesce(m.canceled_at, now()), interval '1 month') as due
where m.plan_key in ('unlimited_12', 'unlimited', 'student')
  and due >= now() - interval '92 days';

-- ---------------------------------------------------------------------------
-- Carnets : un achat de 10 crédits avant chaque dizaine de réservations,
-- décompte à la réservation, recrédit à l'annulation.
-- ---------------------------------------------------------------------------

create temp table seed_pack_usage as
select
  b.*,
  row_number() over (partition by b.member_id order by b.booked_at, b.id) as use_rank
from seed_bookings b
join seed_members m on m.id = b.member_id
where m.plan_key = 'pack' and b.status <> 'waitlisted';

insert into public.payments (id, gym_id, member_id, amount_cents, status, method, description, paid_at, created_at)
select
  pg_temp.sid('pack-pay:' || u.n || ':' || u.use_rank),
  pg_temp.sid('gym'), u.member_id, 18000, 'succeeded', 'card', 'Carnet 10 séances',
  u.booked_at - interval '1 day', u.booked_at - interval '1 day'
from seed_pack_usage u
where (u.use_rank - 1) % 10 = 0;

insert into public.credit_ledger (gym_id, member_id, delta, reason, payment_id, expires_at, created_at)
select
  pg_temp.sid('gym'), u.member_id, 10, 'purchase', pg_temp.sid('pack-pay:' || u.n || ':' || u.use_rank),
  u.booked_at - interval '1 day' + interval '120 days', u.booked_at - interval '1 day'
from seed_pack_usage u
where (u.use_rank - 1) % 10 = 0;

insert into public.credit_ledger (gym_id, member_id, delta, reason, booking_id, created_at)
select pg_temp.sid('gym'), member_id, -1, 'booking', id, booked_at
from seed_pack_usage;

insert into public.credit_ledger (gym_id, member_id, delta, reason, booking_id, created_at)
select pg_temp.sid('gym'), member_id, 1, 'booking_refund', id, least(now() - interval '1 minute', starts_at - interval '3 hours')
from seed_pack_usage
where status = 'cancelled';

-- ---------------------------------------------------------------------------
-- Coachs : disponibilités et créneaux réalisés (base de la paie)
-- ---------------------------------------------------------------------------

insert into public.coach_availabilities (gym_id, coach_id, weekday, start_time, end_time, valid_from)
select distinct
  pg_temp.sid('gym'), pg_temp.sid('c:' || coach), wd,
  start_time - interval '1 hour', start_time + make_interval(mins => duration) + interval '1 hour',
  current_date - 120
from seed_templates, unnest(weekdays) as wd;

insert into public.coach_shifts (gym_id, coach_id, session_id, replaced_coach_id, starts_at, ends_at, status)
select
  pg_temp.sid('gym'), pg_temp.sid('c:' || coach), id,
  case when coach <> default_coach then pg_temp.sid('c:' || default_coach) end,
  starts_at, ends_at,
  case when starts_at < now() then 'done' else 'planned' end::public.shift_status
from seed_sessions
where not cancelled;

-- ---------------------------------------------------------------------------
-- CRM : quelques échanges pour la timeline
-- ---------------------------------------------------------------------------

insert into public.interactions (gym_id, member_id, channel, direction, subject, summary, occurred_at, source_ref, created_by)
select
  pg_temp.sid('gym'), m.id,
  case when m.n % 2 = 0 then 'email' else 'whatsapp' end::public.interaction_channel,
  'inbound',
  case when m.n % 2 = 0 then 'Renseignements' end,
  pg_temp.pick(array[
    'Demande les tarifs et s''il existe une offre étudiante.',
    'Souhaite faire une séance d''essai de CrossFit samedi.',
    'Prépare un Hyrox au printemps, demande le planning des cours.',
    'Débutante, demande si le Renfo est accessible sans expérience.',
    'Demande si le running club accepte les non-abonnés.'
  ], 'prospect-msg', m.n::text),
  m.created_at, 'demo-' || m.n, null
from seed_members m
where m.status = 'prospect';

insert into public.interactions (gym_id, member_id, channel, direction, subject, summary, occurred_at, source_ref, created_by)
select
  pg_temp.sid('gym'), m.id, 'email', 'outbound', 'Échec de paiement',
  'Relance : le dernier prélèvement de l''abonnement a échoué, lien de mise à jour envoyé.',
  now() - interval '9 days', 'demo-relance-' || m.n, pg_temp.sid('u:staff:gerant')
from seed_members m
where m.status = 'suspended';

insert into public.interactions (gym_id, member_id, channel, direction, summary, occurred_at, created_by)
select
  pg_temp.sid('gym'), m.id, 'note', 'internal',
  'Gêne à l''épaule droite : adapter les mouvements au-dessus de la tête.',
  now() - make_interval(days => 10 + floor(pg_temp.rnd('note', m.n::text) * 50)::int),
  pg_temp.sid('u:staff:accueil')
from public.members m_row
join seed_members m on m.id = m_row.id
where 'blessure' = any (m_row.tags);

-- File d'envoi : avis d'annulation déjà journalisés pour les séances annulées.
select private.notify_session_members(
  s.id, 'session_cancelled',
  'Séance annulée : ' || private.session_label(s.id),
  'La séance ' || private.session_label(s.id)
    || ' est annulée (Coach indisponible). Votre réservation est annulée et, le cas échéant, votre crédit vous est rendu.',
  array['cancelled']::public.booking_status[]
)
from public.class_sessions s
where s.gym_id = pg_temp.sid('gym') and s.status = 'cancelled'
order by s.starts_at;

update public.outbound_messages o
set status = 'logged',
    created_at = least(now(), s.starts_at - interval '1 day'),
    processed_at = least(now(), s.starts_at - interval '1 day') + interval '1 minute'
from public.class_sessions s
where s.id = o.ref_id;

update public.interactions i
set occurred_at = o.created_at
from public.outbound_messages o
where i.source_ref = 'outbound:' || o.id;
