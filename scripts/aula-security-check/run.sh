#!/usr/bin/env bash
# Run real Aula migrations and role/JWT assertions in a disposable local cluster.
# No URLs, environment credentials or remote database connections are accepted.
set -euo pipefail

TASK_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TASK_HERE="$TASK_ROOT/scripts/aula-security-check"
TASK_PG_BIN="${PG_BIN:-$(find /usr/lib/postgresql -path '*/bin/initdb' -type f -printf '%h\n' 2>/dev/null | sort -V | tail -1 || true)}"
export PATH="$TASK_PG_BIN:$PATH"
for tool in initdb pg_ctl psql; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing PostgreSQL tool: $tool. Install PostgreSQL or set PG_BIN to its bin directory." >&2
    exit 1
  fi
done
TASK_WORK="$(mktemp -d)"
TASK_PORT="${PORT:-55433}"
cleanup() {
  pg_ctl -D "$TASK_WORK/data" stop -m fast >/dev/null 2>&1 || true
  rm -rf "$TASK_WORK"
}
trap cleanup EXIT

initdb -D "$TASK_WORK/data" -U postgres --auth=trust >/dev/null
if ! pg_ctl -D "$TASK_WORK/data" -o "-p $TASK_PORT -k $TASK_WORK -c listen_addresses=''" -l "$TASK_WORK/server.log" -w start >/dev/null; then
  cat "$TASK_WORK/server.log" >&2
  exit 1
fi
TASK_PSQL=(psql -X -h "$TASK_WORK" -p "$TASK_PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${TASK_PSQL[@]}" -c 'create database aula_security;'
TASK_PSQL+=(-d aula_security)
"${TASK_PSQL[@]}" -f "$TASK_HERE/bootstrap.sql"
TASK_MIGRATIONS="$TASK_ROOT/supabase/migrations"
"${TASK_PSQL[@]}" -f "$TASK_MIGRATIONS/20260611200000_cohorts_and_aula.sql"
"${TASK_PSQL[@]}" -f "$TASK_MIGRATIONS/20260611201000_cohort_re_cohorting.sql"
"${TASK_PSQL[@]}" -f "$TASK_MIGRATIONS/20260612090000_aula_files.sql"
"${TASK_PSQL[@]}" -f "$TASK_MIGRATIONS/20260613100000_aula_channels.sql"
"${TASK_PSQL[@]}" -f "$TASK_HERE/seed.sql"
"${TASK_PSQL[@]}" -f "$TASK_MIGRATIONS/20261112120000_aula_scope_integrity.sql"
"${TASK_PSQL[@]}" -f "$TASK_MIGRATIONS/20261112120000_aula_scope_integrity.sql"
echo 'Aula scope migration applied twice (idempotency check)'
"${TASK_PSQL[@]}" -f "$TASK_HERE/checks.sql"
