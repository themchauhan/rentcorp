#!/usr/bin/env bash
# Backup + real restore test against the LOCAL Supabase database.
#
#   npm run db:backup-test
#
# 1. Dumps the app schemas (public, private, auth) with pg_dump.
# 2. Restores the dump into a brand-new, separate database.
# 3. Compares row counts of every app table between the two, and checks
#    RLS is still enabled after the restore.
# The dump file is kept in ./backups/ (git-ignored) for inspection.
set -euo pipefail

CONTAINER="supabase_db_$(grep -m1 '^project_id' supabase/config.toml | cut -d'"' -f2)"
RESTORE_DB="restore_test"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups
DUMP="backups/local-${STAMP}.dump"

psql_in() { docker exec -i "$CONTAINER" psql -U supabase_admin -v ON_ERROR_STOP=1 -tA "$@"; }

echo "→ Dumping from $CONTAINER"
docker exec "$CONTAINER" pg_dump -U postgres -d postgres -Fc \
  --schema=public --schema=private --schema=auth > "$DUMP"
echo "  $(du -h "$DUMP" | cut -f1) written to $DUMP"

echo "→ Restoring into a fresh database '$RESTORE_DB'"
psql_in -d postgres -c "drop database if exists $RESTORE_DB" >/dev/null
psql_in -d postgres -c "create database $RESTORE_DB" >/dev/null
# Extensions the schema depends on live outside the dumped schemas.
psql_in -d "$RESTORE_DB" -c "drop schema public cascade; create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions;" >/dev/null
# Supabase's auth helper functions are recreated with the auth schema dump.
docker exec -i "$CONTAINER" pg_restore -U supabase_admin -d "$RESTORE_DB" --no-owner --exit-on-error < "$DUMP" \
  || { echo "✗ restore failed"; exit 1; }

echo "→ Comparing row counts"
TABLES=$(psql_in -d postgres -c "select string_agg(format('%I.%I', schemaname, tablename), ' ' order by schemaname, tablename) from pg_tables where schemaname in ('public','private') or (schemaname = 'auth' and tablename in ('users','identities'))")
FAIL=0
for t in $TABLES; do
  a=$(psql_in -d postgres -c "select count(*) from $t")
  b=$(psql_in -d "$RESTORE_DB" -c "select count(*) from $t")
  if [ "$a" = "$b" ]; then printf "  ✓ %-38s %s\n" "$t" "$a"; else printf "  ✗ %-38s %s ≠ %s\n" "$t" "$a" "$b"; FAIL=1; fi
done

no_rls=$(psql_in -d "$RESTORE_DB" -c "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")
if [ "$no_rls" = "0" ]; then echo "  ✓ RLS still enabled on every public table"; else echo "  ✗ $no_rls public tables lost RLS"; FAIL=1; fi

psql_in -d postgres -c "drop database $RESTORE_DB" >/dev/null
if [ "$FAIL" = "0" ]; then echo "✓ Backup restored and verified"; else echo "✗ Restore verification failed"; exit 1; fi
