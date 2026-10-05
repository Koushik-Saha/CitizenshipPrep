# End-to-end checks

Browser checks run against a scratch database with made-up content, so they
never touch real questions or need a real inbox.

```bash
pnpm db:start
# Scratch database: Neon stand-in, migrations, then the fixture.
docker compose -f db/local/compose.yaml exec -T db psql -U postgres -c 'drop database if exists oathly_e2e with (force)' -c 'create database oathly_e2e'
docker compose -f db/local/compose.yaml exec -T db psql -U postgres -d oathly_e2e < db/local/neon-shim.sql
pnpm exec dbmate --url "postgres://postgres:postgres@127.0.0.1:54329/oathly_e2e?sslmode=disable" \
  --migrations-dir db/migrations --migrations-table private.schema_migrations --no-dump-schema up
docker compose -f db/local/compose.yaml exec -T db psql -U postgres -d oathly_e2e < apps/web/e2e/fixture.sql

# Web app against it, with the development-only test sign-in switched on.
DATABASE_URL="postgres://postgres:postgres@127.0.0.1:54329/oathly_e2e?sslmode=disable" \
TEST_SIGN_IN_SECRET="$(openssl rand -hex 32)" pnpm --filter @oathly/web dev
```

Sign in as the fixture learner by opening
`/api/test/sign-in?user=learner&secret=<TEST_SIGN_IN_SECRET>`. The test
sign-in exists only on a development server started with that variable; a
production build cannot turn it on.

A second learner, `user=estudiante`, studies in Spanish. The first 24
Testland questions have approved Spanish translations and the last six do
not, so her sessions show both cases: questions with a "show in the exam's
language" switch, and questions that fall back to the exam's wording.
