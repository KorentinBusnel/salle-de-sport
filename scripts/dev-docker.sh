#!/usr/bin/env bash
# Démarre le daemon Docker s'il ne tourne pas (sessions Claude Code cloud :
# le daemon n'est pas lancé au démarrage du conteneur). Idempotent.
set -euo pipefail

if docker info >/dev/null 2>&1; then
  echo "Docker est déjà démarré."
  exit 0
fi

if ! command -v dockerd >/dev/null 2>&1; then
  echo "dockerd introuvable : installez Docker ou utilisez un projet Supabase en ligne." >&2
  exit 1
fi

# Après un redémarrage du conteneur, docker.pid peut pointer vers un PID réattribué
# à un autre processus : dockerd refuse alors de démarrer. On nettoie ce cas.
pid_file=/var/run/docker.pid
if [ -f "$pid_file" ]; then
  old_pid="$(cat "$pid_file")"
  if [ "$(ps -o comm= -p "$old_pid" 2>/dev/null)" != "dockerd" ]; then
    rm -f "$pid_file" /var/run/docker.sock
  fi
fi

log_file="${TMPDIR:-/tmp}/dockerd.log"
nohup dockerd >"$log_file" 2>&1 &

for _ in $(seq 1 30); do
  if docker info >/dev/null 2>&1; then
    echo "Docker démarré (journal : $log_file)."
    exit 0
  fi
  sleep 1
done

echo "Docker n'a pas démarré en 30 s, voir $log_file" >&2
exit 1
