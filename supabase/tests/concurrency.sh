#!/usr/bin/env bash
# Test de concurrence de book_session (BRIEF §3) : N adhérents réservent EN MÊME TEMPS une
# séance de C places. Le verrou sur la séance doit donner exactement C confirmées, N − C en
# liste d'attente aux positions 1…N−C, et des compteurs exacts.
# Utilise une salle dédiée, supprimée à la fin. Nécessite psql et Supabase local démarré.
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
PARTICIPANTS="${PARTICIPANTS:-30}"
CAPACITY="${CAPACITY:-16}"
GYM="dd000000-0000-0000-0000-000000000000"
SESSION="dd600000-0000-0000-0000-000000000001"

q() { psql "$DB_URL" -v ON_ERROR_STOP=1 -qAtX "$@"; }

cleanup() {
  q <<SQL >/dev/null
delete from public.credit_ledger where gym_id = '$GYM';
delete from public.bookings where gym_id = '$GYM';
delete from public.class_sessions where gym_id = '$GYM';
delete from public.disciplines where gym_id = '$GYM';
delete from public.members where gym_id = '$GYM';
delete from public.gym_roles where gym_id = '$GYM';
delete from public.gyms where id = '$GYM';
delete from auth.users where email like 'concurrence-%@test.local';
SQL
}
trap cleanup EXIT
cleanup

# Salle, séance et adhérents actifs avec des crédits.
q <<SQL >/dev/null
insert into public.gyms (id, name, slug, settings)
values ('$GYM', 'Salle concurrence', 'concurrence', '{"max_upcoming_bookings": 5}');
insert into public.disciplines (id, gym_id, name, color)
values ('dd400000-0000-0000-0000-000000000001', '$GYM', 'CrossFit', '#dc2626');
insert into public.class_sessions (id, gym_id, discipline_id, starts_at, ends_at, capacity)
values ('$SESSION', '$GYM', 'dd400000-0000-0000-0000-000000000001',
        now() + interval '1 day', now() + interval '1 day 1 hour', $CAPACITY);
insert into auth.users (id, email)
select ('dd100000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'concurrence-' || n || '@test.local'
from generate_series(1, $PARTICIPANTS) as n;
insert into public.members (id, gym_id, profile_id, first_name, last_name, status)
select ('dd200000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, '$GYM',
       ('dd100000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'Adhérent', n::text, 'active'
from generate_series(1, $PARTICIPANTS) as n;
insert into public.credit_ledger (gym_id, member_id, delta, reason)
select '$GYM', ('dd200000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 10, 'purchase'
from generate_series(1, $PARTICIPANTS) as n;
SQL

# Toutes les réservations partent en parallèle, chacune dans sa propre connexion.
pids=()
for n in $(seq 1 "$PARTICIPANTS"); do
  user_id="dd100000-0000-0000-0000-$(printf '%012d' "$n")"
  q <<SQL >/dev/null &
begin;
select set_config('role', 'authenticated', true),
       set_config('request.jwt.claims', '{"sub": "$user_id", "role": "authenticated"}', true);
select public.book_session('$SESSION');
commit;
SQL
  pids+=($!)
done
failures=0
for pid in "${pids[@]}"; do wait "$pid" || failures=$((failures + 1)); done

result="$(q <<SQL
select
  (select count(*) from public.bookings where session_id = '$SESSION' and status = 'confirmed'),
  (select count(*) from public.bookings where session_id = '$SESSION' and status = 'waitlisted'),
  (select count(distinct waitlist_position) from public.bookings where session_id = '$SESSION' and status = 'waitlisted'),
  (select coalesce(max(waitlist_position), 0) from public.bookings where session_id = '$SESSION'),
  (select booked_count || '/' || waitlist_count from public.class_sessions where id = '$SESSION'),
  (select count(*) from public.credit_ledger where gym_id = '$GYM' and reason = 'booking')
SQL
)"
IFS='|' read -r confirmed waitlisted distinct_positions max_position counters debits <<<"$result"
expected_waitlist=$((PARTICIPANTS - CAPACITY))

echo "Réservations simultanées : $PARTICIPANTS sur $CAPACITY places (échecs d'appel : $failures)"
echo "Confirmées : $confirmed · Liste d'attente : $waitlisted (positions distinctes : $distinct_positions, max $max_position) · Compteurs : $counters · Crédits débités : $debits"

if [ "$failures" -eq 0 ] \
  && [ "$confirmed" -eq "$CAPACITY" ] \
  && [ "$waitlisted" -eq "$expected_waitlist" ] \
  && [ "$distinct_positions" -eq "$expected_waitlist" ] \
  && [ "$max_position" -eq "$expected_waitlist" ] \
  && [ "$counters" = "$CAPACITY/$expected_waitlist" ] \
  && [ "$debits" -eq "$CAPACITY" ]; then
  echo "OK : aucune surréservation."
else
  echo "ÉCHEC : résultat incohérent sous concurrence." >&2
  exit 1
fi
