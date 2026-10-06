-- Synthèse d'une fiche adhérent (accueil et gérant) : fidélité, offre et crédits, derniers emails ;
-- finances (montants payés) pour le gérant seulement. Une seule lecture, calculée en base.

create function public.member_overview(p_member_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member public.members;
  v_manager boolean;
  v_loyalty jsonb;
  v_offer jsonb;
  v_finance jsonb;
  v_emails jsonb;
begin
  select * into v_member from public.members where id = p_member_id;
  if v_member.id is null then
    raise exception 'member_not_found';
  end if;
  if not private.is_gym_staff(v_member.gym_id) then
    raise exception 'forbidden';
  end if;
  v_manager := private.is_gym_manager(v_member.gym_id);

  -- Fidélité : séances suivies (au total, sur 30 jours et les 30 précédents), absences, venues.
  select jsonb_build_object(
    'member_since', v_member.created_at,
    'attended', count(*) filter (where b.status = 'attended'),
    'no_shows', count(*) filter (where b.status = 'no_show'),
    'attended_30d', count(*) filter (
      where b.status = 'attended' and s.starts_at >= now() - interval '30 days'),
    'attended_prev_30d', count(*) filter (
      where b.status = 'attended'
        and s.starts_at >= now() - interval '60 days'
        and s.starts_at < now() - interval '30 days'),
    'first_visit', min(s.starts_at) filter (where b.status = 'attended'),
    'last_visit', max(s.starts_at) filter (where b.status = 'attended'),
    'upcoming', count(*) filter (
      where b.status in ('confirmed', 'waitlisted') and s.starts_at > now())
  )
  into v_loyalty
  from public.bookings b
  join public.class_sessions s on s.id = b.session_id and s.gym_id = b.gym_id
  where b.member_id = v_member.id;

  -- Offre en cours et crédits : prochain lot à expirer parmi ceux qui ont un restant.
  select jsonb_build_object(
    'subscription', (
      select jsonb_build_object(
        'plan', p.name, 'type', p.type, 'status', sub.status,
        'current_period_end', sub.current_period_end,
        'commitment_ends_at', sub.commitment_ends_at,
        'cancel_at', sub.cancel_at,
        'online', sub.stripe_subscription_id is not null)
      from public.subscriptions sub
      join public.plans p on p.id = sub.plan_id and p.gym_id = sub.gym_id
      where sub.member_id = v_member.id
        and sub.status in ('active', 'trialing', 'past_due')
      order by sub.created_at desc
      limit 1),
    'credits', private.credit_balance(v_member.id),
    'next_expiry', (
      select min(l.expires_at)
      from public.credit_ledger l
      where l.member_id = v_member.id
        and l.id = l.lot_id
        and l.expires_at > now()
        and private.lot_remaining(l.id) > 0),
    'last_plan', (
      select p.name
      from public.payments pay
      join public.plans p on p.id = pay.plan_id and p.gym_id = pay.gym_id
      where pay.member_id = v_member.id and pay.status = 'succeeded'
      order by coalesce(pay.paid_at, pay.created_at) desc
      limit 1)
  )
  into v_offer;

  -- Finances : gérant seulement (règle des finances), sinon null.
  if v_manager then
    select jsonb_build_object(
      'total_paid_cents', coalesce(sum(amount_cents) filter (where status = 'succeeded'), 0),
      'payments', count(*) filter (where status = 'succeeded'),
      'failed', count(*) filter (where status = 'failed'),
      'last_payment_at', max(coalesce(paid_at, created_at)) filter (where status = 'succeeded'))
    into v_finance
    from public.payments
    where member_id = v_member.id;
  end if;

  -- Derniers emails envoyés à l'adhérent (toutes origines) et consentement marketing.
  select jsonb_build_object(
    'consent_at', v_member.marketing_email_consent_at,
    'last', coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'subject', m.subject, 'origin', m.origin, 'status', m.status,
      'created_at', m.created_at) order by m.created_at desc), '[]'::jsonb))
  into v_emails
  from (
    select id, subject, origin, status, created_at
    from public.outbound_messages
    where member_id = v_member.id and channel = 'email'
    order by created_at desc
    limit 5
  ) m;

  return jsonb_build_object(
    'loyalty', v_loyalty,
    'offer', v_offer,
    'finance', v_finance,
    'emails', v_emails
  );
end;
$$;

revoke all on function public.member_overview(uuid) from public, anon;
grant execute on function public.member_overview(uuid) to authenticated;
