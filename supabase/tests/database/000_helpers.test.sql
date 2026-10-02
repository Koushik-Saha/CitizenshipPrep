-- Helpers shared by the other test files. This file is not wrapped in a
-- transaction that rolls back, so the `tests` schema stays in the local
-- database for the files that run after it. It is never part of a migration.

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Creates an auth user (and, through the trigger, a profile) with a known id.
create or replace function tests.create_user(user_id uuid, email text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (
    user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    email,
    jsonb_build_object('display_name', split_part(email, '@', 1))
  );
$$;

-- Makes the rest of the transaction run the way a request from this signed-in
-- user would: the `authenticated` role, with their id in the JWT claims.
create or replace function tests.authenticate_as(user_id uuid)
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

-- A request with no session.
create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end;
$$;

-- Back to the superuser, for arranging data and inspecting results.
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
select has_function('tests', 'authenticate_as', array['uuid'], 'test helpers are installed');
select * from finish();
rollback;
