#!/usr/bin/env bash
# Lokalny test polityk RLS z migracji 20261104120000 (nie dotyka Supabase).
#
# Stawia jednorazowy klaster PostgreSQL w katalogu tymczasowym, zakłada role
# podobne do Supabase (anon / authenticated / service_role), aplikuje migracje
# repo dla announcements / official_events / usos_registrations, potem migrację
# pivotu (dwukrotnie — idempotencja) i uruchamia checks.sql.
#
# Wymaga binarek PostgreSQL (initdb, pg_ctl, psql), np. `apt install postgresql`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/scripts/pivot-rls-check"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PG_BIN:$PATH"
WORK="$(mktemp -d)"
PORT="${PORT:-55432}"

cleanup() { pg_ctl -D "$WORK/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

initdb -D "$WORK/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$WORK/data" -o "-p $PORT -k $WORK" -l "$WORK/server.log" start >/dev/null
sleep 1

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -c "create database rls;"
PSQL+=(-d rls)

"${PSQL[@]}" -f "$HERE/bootstrap.sql" 2>/dev/null
M="$ROOT/supabase/migrations"
"${PSQL[@]}" -f "$M/20260412120000_announcements.sql"
"${PSQL[@]}" -f "$M/20260414120000_announcements_source.sql"
sed -n '1,21p' "$M/20260512120000_admin_moderation_rls.sql" | "${PSQL[@]}"
"${PSQL[@]}" -f "$M/20260608170000_official_events.sql"
"${PSQL[@]}" -f "$M/20260627100000_usos_registrations.sql" >/dev/null
"${PSQL[@]}" -f "$M/20260628100000_usos_registrations_source.sql"
"${PSQL[@]}" -f "$M/20260628110000_usos_registrations_live_source.sql"
"${PSQL[@]}" -f "$M/20260629110000_usos_unique_full_index.sql"
"${PSQL[@]}" -f "$M/20260715120000_announcements_multi_faculty.sql"

"${PSQL[@]}" -f "$M/20261104120000_public_information_read_access.sql" 2>/dev/null
"${PSQL[@]}" -f "$M/20261104120000_public_information_read_access.sql" 2>/dev/null
echo "migration applied twice (idempotent)"

psql -h "$WORK" -p "$PORT" -U postgres -d rls -f "$HERE/checks.sql"
