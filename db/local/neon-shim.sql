-- Makes a plain Postgres database look like a Neon branch with the Data API
-- enabled, so the migrations and tests run the same locally and in CI.
-- Local only: never run this against Neon, which provides the real thing.

do $$
begin
  if to_regrole('authenticated') is null then
    create role authenticated nologin;
  end if;
  if to_regrole('anonymous') is null then
    create role anonymous nologin;
  end if;
end;
$$;

-- Neon's pg_session_jwt extension provides auth.user_id(). Without a JWKS it
-- reads the PostgREST-style request.jwt.claims setting, which is what this does.
create schema if not exists auth;
grant usage on schema auth to anonymous, authenticated;

create or replace function auth.user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
$$;

-- pgTAP goes in its own schema so it stays out of `public` and out of the
-- generated types.
create schema if not exists extensions;
grant usage on schema extensions to anonymous, authenticated;
create extension if not exists pgtap with schema extensions;

do $$
begin
  execute format(
    'alter database %I set search_path = "$user", public, extensions',
    current_database()
  );
end;
$$;
