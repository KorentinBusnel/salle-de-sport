-- Paiements en ligne (Stripe, BRIEF §8 et §12 du 2026-10-06) : les Edge Functions parlent à
-- Stripe ; la base reste le miroir, tenu par une seule fonction (apply_stripe_event) appelée par
-- le webhook avec la clé service_role, dans une transaction et une seule fois par événement.
-- Abonnement : accès selon le statut Stripe (un prélèvement SEPA en cours vaut accès) ; un
-- échec passe en impayé et prévient l'adhérent. Carnet ou séance : crédits au paiement réussi.

alter type public.message_origin add value if not exists 'billing';

-- ---------------------------------------------------------------------------
-- Préparation d'un achat dans l'app (appelée par l'Edge Function avec le jeton de l'adhérent)
-- ---------------------------------------------------------------------------

create function public.billing_checkout_context(p_plan_id uuid, p_promo_code text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_member public.members;
  v_promo public.promo_codes;
begin
  select * into v_plan from public.plans where id = p_plan_id;
  if not found then
    raise exception 'plan_not_found';
  end if;
  select * into v_member from public.members
  where gym_id = v_plan.gym_id and profile_id = (select auth.uid());
  if not found then
    raise exception 'not_a_member';
  end if;
  if not v_plan.is_active then
    raise exception 'plan_inactive';
  end if;
  if v_member.status in ('suspended', 'cancelled') then
    raise exception 'member_not_active';
  end if;
  if v_plan.type = 'recurring' and private.has_active_subscription(v_member.id) then
    raise exception 'already_subscribed';
  end if;
  v_promo := private.resolve_promo(v_plan.gym_id, p_promo_code, v_plan.id);

  return jsonb_build_object(
    'member', jsonb_build_object(
      'id', v_member.id, 'gym_id', v_member.gym_id, 'email', v_member.email,
      'name', v_member.first_name || ' ' || v_member.last_name,
      'stripe_customer_id', v_member.stripe_customer_id),
    'plan', jsonb_build_object(
      'id', v_plan.id, 'name', v_plan.name, 'type', v_plan.type,
      'price_cents', v_plan.price_cents, 'currency', v_plan.currency,
      'billing_interval', v_plan.billing_interval, 'credits', v_plan.credits,
      'stripe_product_id', v_plan.stripe_product_id, 'stripe_price_id', v_plan.stripe_price_id),
    'final_cents', private.discounted_price(v_plan.price_cents, v_promo),
    'promo', case when v_promo.id is null then null else jsonb_build_object(
      'id', v_promo.id, 'code', v_promo.code, 'kind', v_promo.kind, 'value', v_promo.value,
      'stripe_coupon_id', v_promo.stripe_coupon_id) end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Lecture tolérante des objets Stripe (les versions de l'API déplacent quelques champs)
-- ---------------------------------------------------------------------------

create function private.stripe_ts(p_value jsonb)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case when p_value is null or jsonb_typeof(p_value) <> 'number' then null
              else to_timestamp((p_value #>> '{}')::bigint) end;
$$;

-- Identifiant d'un champ qui peut être une chaîne ou un objet développé ({ "id": … }).
create function private.stripe_id(p_value jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case jsonb_typeof(p_value)
           when 'string' then p_value #>> '{}'
           when 'object' then p_value ->> 'id'
         end;
$$;

-- Adhérent d'un objet Stripe : métadonnée member_id, sinon client Stripe connu.
create function private.stripe_member(p_object jsonb)
returns public.members
language sql
stable
security definer
set search_path = ''
as $$
  select m.* from public.members m
  where m.id::text = p_object #>> '{metadata,member_id}'
     or m.stripe_customer_id = private.stripe_id(p_object -> 'customer')
  order by (m.id::text = p_object #>> '{metadata,member_id}') desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Abonnements : miroir d'un objet subscription Stripe
-- ---------------------------------------------------------------------------

create function private.sync_stripe_subscription(p_sub jsonb)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_plan public.plans;
  v_item jsonb := p_sub #> '{items,data,0}';
  v_status public.subscription_status;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_cancel_at timestamptz;
  v_row public.subscriptions;
  v_known public.subscriptions;
begin
  -- Abonnement déjà connu : son adhérent et son offre servent de repli (objet sans métadonnées).
  select * into v_known from public.subscriptions where stripe_subscription_id = p_sub ->> 'id';
  v_member := private.stripe_member(p_sub);
  if v_member.id is null and v_known.id is not null then
    select * into v_member from public.members where id = v_known.member_id;
  end if;
  if v_member.id is null then
    raise exception 'member_not_found';
  end if;
  select * into v_plan from public.plans
  where gym_id = v_member.gym_id
    and (id::text = p_sub #>> '{metadata,plan_id}'
         or stripe_price_id = private.stripe_id(v_item -> 'price')
         or id = v_known.plan_id)
  order by (id::text = p_sub #>> '{metadata,plan_id}') desc,
           (stripe_price_id is not distinct from private.stripe_id(v_item -> 'price')) desc
  limit 1;
  if not found then
    raise exception 'plan_not_found';
  end if;

  v_status := case p_sub ->> 'status'
    when 'incomplete' then 'incomplete' when 'incomplete_expired' then 'incomplete_expired'
    when 'trialing' then 'trialing' when 'active' then 'active' when 'past_due' then 'past_due'
    when 'paused' then 'paused' when 'canceled' then 'canceled' when 'unpaid' then 'unpaid'
  end::public.subscription_status;
  if v_status is null then
    raise exception 'invalid_input';
  end if;
  v_period_start := coalesce(private.stripe_ts(p_sub -> 'current_period_start'),
                             private.stripe_ts(v_item -> 'current_period_start'));
  v_period_end := coalesce(private.stripe_ts(p_sub -> 'current_period_end'),
                           private.stripe_ts(v_item -> 'current_period_end'));
  v_cancel_at := coalesce(private.stripe_ts(p_sub -> 'cancel_at'),
                          case when (p_sub ->> 'cancel_at_period_end')::boolean then v_period_end end);

  insert into public.subscriptions (
    gym_id, member_id, plan_id, stripe_subscription_id, status, started_at,
    current_period_start, current_period_end, commitment_ends_at, cancel_at, canceled_at
  ) values (
    v_member.gym_id, v_member.id, v_plan.id, p_sub ->> 'id', v_status,
    coalesce(private.stripe_ts(p_sub -> 'start_date'), private.stripe_ts(p_sub -> 'created'), now()),
    v_period_start, v_period_end,
    case when v_plan.commitment_months is not null then
      coalesce(private.stripe_ts(p_sub -> 'start_date'), now())
        + make_interval(months => v_plan.commitment_months) end,
    v_cancel_at, private.stripe_ts(p_sub -> 'canceled_at')
  )
  on conflict (stripe_subscription_id) do update set
    plan_id = excluded.plan_id,
    status = excluded.status,
    current_period_start = coalesce(excluded.current_period_start, public.subscriptions.current_period_start),
    current_period_end = coalesce(excluded.current_period_end, public.subscriptions.current_period_end),
    cancel_at = excluded.cancel_at,
    canceled_at = excluded.canceled_at
  returning * into v_row;

  -- Un prospect qui souscrit devient actif dès que l'abonnement donne accès.
  if v_member.status = 'prospect' and v_status in ('active', 'trialing') then
    update public.members set status = 'active' where id = v_member.id;
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Événements Stripe (webhook) : une seule fois par event.id
-- ---------------------------------------------------------------------------

create function public.apply_stripe_event(p_event jsonb, p_method public.payment_method default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := p_event ->> 'type';
  v_object jsonb := p_event #> '{data,object}';
  v_member public.members;
  v_plan public.plans;
  v_payment public.payments;
  v_intent text;
  v_amount integer;
begin
  insert into public.stripe_events (id, type) values (p_event ->> 'id', v_type)
  on conflict (id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  if v_type in ('customer.subscription.created', 'customer.subscription.updated',
                'customer.subscription.deleted') then
    perform private.sync_stripe_subscription(v_object);
    return 'subscription';
  end if;

  if v_type in ('invoice.paid', 'invoice.payment_failed') then
    v_member := private.stripe_member(v_object);
    if v_member.id is null then
      return 'ignored';
    end if;
    v_intent := coalesce(private.stripe_id(v_object -> 'payment_intent'),
                         private.stripe_id(v_object #> '{payments,data,0,payment,payment_intent}'));
    select p.* into v_plan from public.subscriptions s join public.plans p on p.id = s.plan_id
    where s.stripe_subscription_id = coalesce(private.stripe_id(v_object -> 'subscription'),
                                              v_object #>> '{parent,subscription_details,subscription}');
    v_amount := case when v_type = 'invoice.paid' then (v_object ->> 'amount_paid')::integer
                     else (v_object ->> 'amount_due')::integer end;

    insert into public.payments (gym_id, member_id, amount_cents, currency, status, method,
                                 description, stripe_invoice_id, stripe_payment_intent_id,
                                 paid_at, plan_id)
    values (v_member.gym_id, v_member.id, coalesce(v_amount, 0),
            coalesce(v_object ->> 'currency', 'eur'),
            case when v_type = 'invoice.paid' then 'succeeded' else 'failed' end::public.payment_status,
            coalesce(p_method, 'card'), coalesce(v_plan.name, 'Abonnement'), v_object ->> 'id', v_intent,
            case when v_type = 'invoice.paid' then
              coalesce(private.stripe_ts(v_object #> '{status_transitions,paid_at}'), now()) end,
            v_plan.id)
    on conflict (stripe_invoice_id) do update set
      status = excluded.status,
      amount_cents = excluded.amount_cents,
      method = excluded.method,
      paid_at = coalesce(excluded.paid_at, public.payments.paid_at),
      stripe_payment_intent_id = coalesce(excluded.stripe_payment_intent_id, public.payments.stripe_payment_intent_id)
    returning * into v_payment;

    if v_type = 'invoice.payment_failed' then
      -- Accès suspendu jusqu'au paiement (le statut Stripe suivra aussi par subscription.updated).
      update public.subscriptions set status = 'past_due'
      where stripe_subscription_id = coalesce(private.stripe_id(v_object -> 'subscription'),
                                              v_object #>> '{parent,subscription_details,subscription}')
        and status in ('active', 'trialing');
      perform private.enqueue_message(
        v_member.id, 'billing',
        'Votre paiement n''a pas abouti',
        'Le paiement de votre abonnement n''a pas pu être encaissé. Mettez à jour votre moyen de paiement depuis l''app (Compte › Gérer mon moyen de paiement) pour continuer à réserver.',
        v_payment.id, 'invoice-failed:' || (v_object ->> 'id'));
    end if;
    return 'invoice';
  end if;

  -- Carnet ou séance payé en une fois (PaymentIntent marqué kind = pack).
  if v_type in ('payment_intent.succeeded', 'payment_intent.payment_failed')
     and v_object #>> '{metadata,kind}' = 'pack' then
    v_member := private.stripe_member(v_object);
    select * into v_plan from public.plans
    where id::text = v_object #>> '{metadata,plan_id}' and gym_id = v_member.gym_id;
    if v_member.id is null or v_plan.id is null then
      return 'ignored';
    end if;
    insert into public.payments (gym_id, member_id, amount_cents, currency, status, method,
                                 description, stripe_payment_intent_id, paid_at, plan_id,
                                 promo_code_id)
    values (v_member.gym_id, v_member.id, (v_object ->> 'amount')::integer,
            coalesce(v_object ->> 'currency', 'eur'),
            case when v_type = 'payment_intent.succeeded' then 'succeeded' else 'failed' end::public.payment_status,
            coalesce(p_method, 'card'), v_plan.name, v_object ->> 'id',
            case when v_type = 'payment_intent.succeeded' then now() end, v_plan.id,
            (select id from public.promo_codes
             where id::text = v_object #>> '{metadata,promo_code_id}' and gym_id = v_member.gym_id))
    on conflict (stripe_payment_intent_id) do update set
      status = excluded.status,
      paid_at = coalesce(excluded.paid_at, public.payments.paid_at)
    returning * into v_payment;

    if v_type = 'payment_intent.succeeded' and not exists (
      select 1 from public.credit_ledger where payment_id = v_payment.id and reason = 'purchase'
    ) then
      insert into public.credit_ledger (gym_id, member_id, delta, reason, payment_id, plan_id,
                                        expires_at, note)
      values (v_member.gym_id, v_member.id, v_plan.credits, 'purchase', v_payment.id, v_plan.id,
              case when v_plan.validity_days is not null
                   then now() + make_interval(days => v_plan.validity_days) end,
              v_plan.name);
      if v_member.status = 'prospect' then
        update public.members set status = 'active' where id = v_member.id;
      end if;
    end if;
    return 'pack';
  end if;

  -- Remboursement total : le paiement est marqué remboursé, les crédits restants du carnet sortent.
  if v_type = 'charge.refunded' and (v_object ->> 'refunded')::boolean then
    v_intent := private.stripe_id(v_object -> 'payment_intent');
    update public.payments set status = 'refunded'
    where stripe_payment_intent_id = v_intent
    returning * into v_payment;
    if v_payment.id is not null then
      insert into public.credit_ledger (gym_id, member_id, delta, reason, lot_id, plan_id, note)
      select l.gym_id, l.member_id, -private.lot_remaining(l.id), 'manual_adjustment', l.id, l.plan_id,
             'Remboursement'
      from public.credit_ledger l
      where l.payment_id = v_payment.id and l.lot_id = l.id and private.lot_remaining(l.id) > 0;
    end if;
    return 'refund';
  end if;

  return 'ignored';
end;
$$;

-- Synchronisation d'un abonnement après une action de l'Edge Function (résiliation) : même
-- miroir que le webhook, sans attendre l'événement.
create function public.sync_stripe_subscription(p_sub jsonb)
returns public.subscriptions
language sql
security definer
set search_path = ''
as $$
  select private.sync_stripe_subscription(p_sub);
$$;

-- ---------------------------------------------------------------------------
-- Droits : les fonctions du webhook ne sont appelables qu'avec la clé service_role
-- ---------------------------------------------------------------------------

revoke all on function
  private.stripe_ts(jsonb),
  private.stripe_id(jsonb),
  private.stripe_member(jsonb),
  private.sync_stripe_subscription(jsonb)
from public, anon, authenticated;

revoke all on function
  public.apply_stripe_event(jsonb, public.payment_method),
  public.sync_stripe_subscription(jsonb)
from public, anon, authenticated;
grant execute on function
  public.apply_stripe_event(jsonb, public.payment_method),
  public.sync_stripe_subscription(jsonb)
to service_role;

revoke all on function public.billing_checkout_context(uuid, text) from public, anon;
grant execute on function public.billing_checkout_context(uuid, text) to authenticated;

-- Les Edge Functions enregistrent l'identifiant client Stripe d'un adhérent (clé service_role) :
-- la colonne de recherche de members est calculée par ces fonctions.
grant usage on schema private to service_role;
grant execute on function private.search_text(text), private.phone_digits(text) to service_role;
