# Database

Postgres on [Neon](https://neon.com). The schema is plain SQL in `migrations/`, applied with
[dbmate](https://github.com/amacneil/dbmate). Row Level Security is on for every table, and
`tests/` proves the access rules with pgTAP.

## Local development

Needs Docker. Nothing here touches Neon.

| Command           | What it does                                                            |
| ----------------- | ----------------------------------------------------------------------- |
| `pnpm db:start`   | Starts Postgres on port 54329; on first run applies migrations and seed |
| `pnpm db:reset`   | Recreates the database from the migrations and `seed.sql`               |
| `pnpm db:migrate` | Applies migrations that have not run yet                                |
| `pnpm db:test`    | Runs the pgTAP tests                                                    |
| `pnpm db:types`   | Regenerates `packages/api/src/database.types.ts`                        |
| `pnpm db:stop`    | Stops the container (data is kept)                                      |

The local database is plain Postgres. `local/neon-shim.sql` adds what a Neon branch with the Data
API has and plain Postgres lacks: the `authenticated` and `anonymous` roles and `auth.user_id()`.

After changing the schema: add a migration, run `pnpm db:reset`, `pnpm db:test` and
`pnpm db:types`, and commit the regenerated types. CI fails if they are out of date.

## Deploying to Neon

1. In the Neon console, enable the **Data API** for the branch. This creates the `authenticated`
   and `anonymous` roles and `auth.user_id()`; the first migration stops with a clear error if they
   are missing.
2. Run `DATABASE_URL="postgresql://..." pnpm db:deploy` with the owner connection string.

`seed.sql` is sample data for local development and is not deployed.

## How access works

- The apps reach the database through the Neon Data API with the signed-in user's JWT. Requests
  run as `authenticated` (or `anonymous` without a JWT) and are filtered by the RLS policies.
- `private.current_user_id()` returns the JWT `sub` claim. User ids are stored as text, so any
  auth provider that issues JWTs works.
- The app creates a `profiles` row on first sign-in. Everything a user owns hangs off it.
- Staff roles (`reviewer`, `admin`) live in `user_roles`. Grant the first admin from the Neon SQL
  editor: `insert into user_roles (user_id, role) values ('<user id>', 'admin');`
- Server-side code connects with `DATABASE_URL` as the owner role, which bypasses RLS. Keep that
  connection string out of the apps.
