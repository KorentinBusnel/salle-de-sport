-- Impayés et relances (BRIEF §12, 2026-10-06) :
-- - liste des impayés pour l'accueil et le gérant, avec les relances déjà envoyées ;
-- - un carnet dont le paiement a échoué n'est pas un impayé (aucun crédit donné) : seuls
--   comptent les échecs de facture d'abonnement et les abonnements en retard ;
-- - relance manuelle (message prêt, modifiable, une par jour au plus) et relances automatiques
--   à J+N1 et J+N2 (réglages internes, 0 = désactivée), messages de service (sans consentement) ;
-- - encaissement sur place d'un abonnement suivi à la main en impayé, par l'accueil ou le
--   gérant, quelle que soit la stratégie de vente (ce n'est pas une nouvelle vente).

-- ---------------------------------------------------------------------------
-- Impayés : une seule définition, lue par la liste, le texte de relance et le job
-- ---------------------------------------------------------------------------

create function private.unpaid_rows(p_gym_id uuid)
returns table (
  member_id uuid,
  first_name text,
  last_name text,
  plan text,
  amount_cents integer,
  currency text,
  failures integer,
  first_failed_at timestamptz,
  subscription_id uuid,
  online boolean,
  settleable boolean,
  reminders integer,
  last_reminded_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with last_ok as (
    select p.member_id, max(p.created_at) as at
    from public.payments p
    where p.gym_id = p_gym_id and p.status = 'succeeded'
    group by p.member_id
  ),
  -- Échecs de facture d'abonnement depuis le dernier paiement réussi.
  fails as (
    select p.member_id, count(*)::integer as failures, min(p.created_at) as first_at,
      (array_agg(p.amount_cents order by p.created_at desc))[1] as amount,
      (array_agg(p.currency order by p.created_at desc))[1] as currency
    from public.payments p
    left join last_ok l on l.member_id = p.member_id
    where p.gym_id = p_gym_id and p.status = 'failed' and p.stripe_invoice_id is not null
      and (l.at is null or p.created_at > l.at)
    group by p.member_id
  ),
  late as (
    select distinct on (s.member_id) s.member_id, s.id, s.status, s.updated_at,
      s.stripe_subscription_id, pl.name, pl.price_cents, pl.currency
    from public.subscriptions s
    join public.plans pl on pl.id = s.plan_id and pl.gym_id = s.gym_id
    where s.gym_id = p_gym_id and s.status in ('past_due', 'unpaid')
    order by s.member_id, s.updated_at desc
  ),
  base as (
    select m.id, m.first_name, m.last_name, l.name as plan,
      coalesce(f.amount, l.price_cents)::integer as amount_cents,
      coalesce(f.currency, l.currency, 'eur') as currency,
      coalesce(f.failures, 1) as failures,
      coalesce(f.first_at, l.updated_at) as first_failed_at,
      l.id as subscription_id,
      (f.member_id is not null or l.stripe_subscription_id is not null) as online,
      (l.id is not null and l.stripe_subscription_id is null and l.status = 'past_due') as settleable
    from public.members m
    left join fails f on f.member_id = m.id
    left join late l on l.member_id = m.id
    where m.gym_id = p_gym_id and (f.member_id is not null or l.member_id is not null)
  )
  select b.id, b.first_name, b.last_name, b.plan, b.amount_cents, b.currency, b.failures,
    b.first_failed_at, b.subscription_id, b.online, b.settleable,
    count(o.id)::integer, max(o.created_at)
  from base b
  left join public.outbound_messages o
    on o.member_id = b.id and o.gym_id = p_gym_id and o.origin = 'billing'
   and o.created_at >= b.first_failed_at
  group by b.id, b.first_name, b.last_name, b.plan, b.amount_cents, b.currency, b.failures,
    b.first_failed_at, b.subscription_id, b.online, b.settleable
  order by b.first_failed_at;
$$;

drop function public.unpaid_members(uuid);

-- Impayés de la salle : accueil et gérant (montant dû, relances, encaissable sur place).
create function public.unpaid_members(p_gym_id uuid)
returns table (
  member_id uuid,
  first_name text,
  last_name text,
  plan text,
  amount_cents integer,
  currency text,
  failures integer,
  first_failed_at timestamptz,
  subscription_id uuid,
  online boolean,
  settleable boolean,
  reminders integer,
  last_reminded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_gym_staff(p_gym_id) then
    raise exception 'forbidden';
  end if;
  return query select * from private.unpaid_rows(p_gym_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Texte de relance (une seule source : dialogue du back office et relances automatiques)
-- ---------------------------------------------------------------------------

create function private.payment_reminder_text(p_member_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_gym public.gyms;
  v_row record;
  v_amount text;
begin
  select * into v_member from public.members where id = p_member_id;
  if not found then
    raise exception 'member_not_found';
  end if;
  select * into v_row from private.unpaid_rows(v_member.gym_id) u where u.member_id = p_member_id;
  if not found then
    raise exception 'not_unpaid';
  end if;
  select * into v_gym from public.gyms where id = v_member.gym_id;
  v_amount := replace(to_char(v_row.amount_cents / 100.0, 'FM999999990.00'), '.', ',')
    || case when v_row.currency = 'eur' then ' €' else ' ' || upper(v_row.currency) end;

  return jsonb_build_object(
    'subject', 'Votre paiement est en attente',
    'body',
      'Bonjour ' || v_member.first_name || E',\n\n'
      || 'Nous n''avons pas reçu le paiement de '
      || coalesce('votre abonnement « ' || v_row.plan || ' »', 'votre abonnement')
      || ' (' || v_amount || '). '
      || 'Tant qu''il n''est pas réglé, la réservation des séances est suspendue.' || E'\n\n'
      || case when v_row.online
           then 'Pour régulariser, mettez à jour votre moyen de paiement dans l''app : Compte › Moyen de paiement et factures. Le prélèvement sera relancé automatiquement.'
           else 'Pour régulariser, passez à l''accueil lors de votre prochaine venue.'
         end
      || E'\n\n' || 'À bientôt,' || E'\n' || v_gym.name
  );
end;
$$;

-- Message proposé pour une relance (dialogue « Relancer » : objet et texte modifiables).
create function public.payment_reminder_preview(p_member_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_gym_id uuid;
begin
  select gym_id into v_gym_id from public.members where id = p_member_id;
  if v_gym_id is null then
    raise exception 'member_not_found';
  end if;
  if not private.is_gym_staff(v_gym_id) then
    raise exception 'forbidden';
  end if;
  return private.payment_reminder_text(p_member_id);
end;
$$;

-- Relance manuelle : une par jour et par adhérent au plus, inscrite au journal.
create function public.send_payment_reminder(p_member_id uuid, p_subject text, p_body text)
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
  if not private.is_gym_staff(v_member.gym_id) then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from private.unpaid_rows(v_member.gym_id) u where u.member_id = p_member_id) then
    raise exception 'not_unpaid';
  end if;
  if coalesce(btrim(p_subject), '') = '' or coalesce(btrim(p_body), '') = ''
    or length(p_subject) > 200 or length(p_body) > 5000 then
    raise exception 'invalid_input';
  end if;

  v_id := private.enqueue_message(
    p_member_id, 'billing', btrim(p_subject), btrim(p_body), null,
    'reminder:' || p_member_id || ':' || (now() at time zone 'utc')::date
  );
  if v_id is null then
    raise exception 'already_reminded';
  end if;
  insert into public.audit_log (gym_id, actor_id, action, entity, entity_id, details)
  values (v_member.gym_id, (select auth.uid()), 'billing.reminder', 'members', p_member_id::text,
          jsonb_build_object('message_id', v_id));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Encaissement d'une période due (abonnement suivi à la main en impayé)
-- ---------------------------------------------------------------------------

-- Une période de plus, payée sur place : partagée par le renouvellement et le règlement.
create function private.extend_manual_period(p_sub public.subscriptions, p_method public.payment_method, p_label text)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_start timestamptz;
  v_sub public.subscriptions;
begin
  if p_method is null or p_method = 'sepa_debit' then
    raise exception 'invalid_input';
  end if;
  select * into v_plan from public.plans where id = p_sub.plan_id;

  insert into public.payments (gym_id, member_id, amount_cents, currency, status, method,
                               description, paid_at, plan_id, recorded_by)
  values (p_sub.gym_id, p_sub.member_id, v_plan.price_cents, v_plan.currency, 'succeeded',
          p_method, v_plan.name || ' (' || p_label || ')', now(), v_plan.id, (select auth.uid()));

  -- La nouvelle période suit la précédente, ou part d'aujourd'hui après un retard.
  v_start := greatest(coalesce(p_sub.current_period_end, now()), now());
  update public.subscriptions
  set status = 'active',
      current_period_start = v_start,
      current_period_end = private.period_end(v_start, v_plan.billing_interval)
  where id = p_sub.id
  returning * into v_sub;
  return v_sub;
end;
$$;

create or replace function public.renew_manual_subscription(p_subscription_id uuid, p_method public.payment_method)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'subscription_not_found';
  end if;
  if not private.can_sell(v_sub.gym_id) then
    raise exception 'forbidden';
  end if;
  if v_sub.stripe_subscription_id is not null or v_sub.cancel_at is not null
    or v_sub.status not in ('active', 'past_due') then
    raise exception 'not_renewable';
  end if;
  return private.extend_manual_period(v_sub, p_method, 'renouvellement');
end;
$$;

-- Règlement d'un impayé sur place : accueil ou gérant, quelle que soit la stratégie de vente.
create function public.settle_unpaid(p_subscription_id uuid, p_method public.payment_method)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'subscription_not_found';
  end if;
  if not private.is_gym_staff(v_sub.gym_id) then
    raise exception 'forbidden';
  end if;
  if v_sub.stripe_subscription_id is not null or v_sub.status <> 'past_due' then
    raise exception 'not_settleable';
  end if;
  v_sub := private.extend_manual_period(v_sub, p_method, 'règlement');
  insert into public.audit_log (gym_id, actor_id, action, entity, entity_id, details)
  values (v_sub.gym_id, (select auth.uid()), 'billing.settle', 'subscriptions', v_sub.id::text,
          jsonb_build_object('member_id', v_sub.member_id, 'method', p_method));
  return v_sub;
end;
$$;

-- ---------------------------------------------------------------------------
-- Relances automatiques (job quotidien)
-- ---------------------------------------------------------------------------

-- Paliers J+N1 et J+N2 depuis le premier échec (réglages internes, 0 = désactivé) ; chaque
-- palier une seule fois par impayé, sauté si l'adhérent a déjà été relancé le jour même.
create function private.run_dunning()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gym record;
  v_row record;
  v_days integer;
  v_text jsonb;
  v_count integer := 0;
begin
  for v_gym in select id from public.gyms loop
    for v_row in select * from private.unpaid_rows(v_gym.id) loop
      for v_step in 1..2 loop
        v_days := case v_step
          when 1 then private.gym_private_int(v_gym.id, 'dunning_first_days', 3, 0, 60)
          else private.gym_private_int(v_gym.id, 'dunning_second_days', 7, 0, 90) end;
        continue when v_days = 0 or v_row.first_failed_at > now() - make_interval(days => v_days);
        continue when v_row.last_reminded_at is not null
          and (v_row.last_reminded_at at time zone 'utc')::date = (now() at time zone 'utc')::date;
        v_text := private.payment_reminder_text(v_row.member_id);
        if private.enqueue_message(
          v_row.member_id, 'billing', v_text ->> 'subject', v_text ->> 'body', null,
          'dunning:' || v_row.member_id || ':' || (v_row.first_failed_at at time zone 'utc')::date || ':' || v_step
        ) is not null then
          v_count := v_count + 1;
          -- Un seul message par jour : le palier suivant attendra le prochain passage.
          exit;
        end if;
      end loop;
    end loop;
  end loop;
  return v_count;
end;
$$;

select cron.schedule('dunning-daily', '30 8 * * *', 'select private.run_dunning();');

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------

revoke all on function
  private.unpaid_rows(uuid),
  private.payment_reminder_text(uuid),
  private.extend_manual_period(public.subscriptions, public.payment_method, text),
  private.run_dunning()
from public, anon, authenticated;

revoke all on function
  public.unpaid_members(uuid),
  public.payment_reminder_preview(uuid),
  public.send_payment_reminder(uuid, text, text),
  public.settle_unpaid(uuid, public.payment_method)
from public, anon;
grant execute on function
  public.unpaid_members(uuid),
  public.payment_reminder_preview(uuid),
  public.send_payment_reminder(uuid, text, text),
  public.settle_unpaid(uuid, public.payment_method)
to authenticated;
