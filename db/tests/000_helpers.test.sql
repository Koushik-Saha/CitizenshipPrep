-- Helpers shared by the other test files. This file is not wrapped in a
-- transaction that rolls back, so the `tests` schema stays in the local
-- database for the files that run after it. It is never part of a migration.

create schema if not exists tests;
grant usage on schema tests to anonymous, authenticated;

-- Creates a user the way the app does on first sign-in: a profile whose id is
-- the auth provider's user id.
create or replace function tests.create_user(user_id text, email text)
returns void
language sql
set search_path = ''
as $$
  insert into public.profiles (id, display_name) values (user_id, split_part(email, '@', 1));
$$;

-- Makes the rest of the transaction run the way a Data API request from this
-- signed-in user would: the `authenticated` role, with their id as the JWT "sub".
create or replace function tests.authenticate_as(user_id text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text,
    true
  );
end;
$$;

-- A request with no JWT.
create or replace function tests.authenticate_as_anonymous()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('role', 'anonymous', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Back to the database owner, for arranging data and inspecting results.
create or replace function tests.clear_authentication()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

begin;
select plan(1);
select has_function('tests', 'authenticate_as', array['text'], 'test helpers are installed');
select * from finish();
rollback;
