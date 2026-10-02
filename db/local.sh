#!/usr/bin/env bash
# Local database tasks. Everything here targets the Docker database only;
# `pnpm db:deploy` is the one command that touches Neon.
set -euo pipefail
cd "$(dirname "$0")/.."

LOCAL_URL="postgres://postgres:postgres@127.0.0.1:54329/oathly?sslmode=disable"
TYPES_FILE="packages/api/src/database.types.ts"

compose() { docker compose -f db/local/compose.yaml "$@"; }
psql_db() { compose exec -T db psql -v ON_ERROR_STOP=1 -q -U postgres -d "$1" "${@:2}"; }
migrate() {
  pnpm exec dbmate --url "$LOCAL_URL" --migrations-dir db/migrations \
    --migrations-table private.schema_migrations --no-dump-schema "$@"
}

reset() {
  psql_db postgres -c 'drop database if exists oathly with (force)' -c 'create database oathly'
  psql_db oathly < db/local/neon-shim.sql
  migrate up
  psql_db oathly < db/seed.sql
  echo "Local database reset: migrations and seed applied."
}

case "${1:-}" in
  start)
    compose up -d --build --wait
    # A fresh volume has no schema yet.
    if [ "$(psql_db oathly -Atc "select to_regclass('public.countries') is null")" = "t" ]; then
      reset
    fi
    ;;
  stop) compose down ;;
  reset) reset ;;
  migrate) migrate up ;;
  test) compose exec -T db pg_prove -U postgres -d oathly --ext .sql /db/tests ;;
  types)
    pnpm exec neon-js gen-types --db-url "$LOCAL_URL" --schema public --output "$TYPES_FILE"
    pnpm exec prettier --write "$TYPES_FILE"
    ;;
  *)
    echo "usage: db/local.sh start|stop|reset|migrate|test|types" >&2
    exit 1
    ;;
esac
