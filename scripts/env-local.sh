#!/usr/bin/env bash
# Écrit les .env.local du back office et de l'app mobile à partir de Supabase local.
# Ces clés sont celles, publiques, de Supabase local : rien de secret.
set -euo pipefail
cd "$(dirname "$0")/.."

status_json="$(pnpm exec supabase status -o json 2>/dev/null)"
read_key() { node -e "process.stdout.write(JSON.parse(process.argv[1])[process.argv[2]] ?? '')" "$status_json" "$1"; }

api_url="$(read_key API_URL)"
anon_key="$(read_key ANON_KEY)"
if [ -z "$api_url" ] || [ -z "$anon_key" ]; then
  echo "Supabase local ne répond pas : lancez d'abord pnpm db:start." >&2
  exit 1
fi

cat > apps/backoffice/.env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=$api_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon_key
ENV
cat > apps/mobile/.env.local <<ENV
EXPO_PUBLIC_SUPABASE_URL=$api_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=$anon_key
ENV
echo "apps/backoffice/.env.local et apps/mobile/.env.local écrits."
