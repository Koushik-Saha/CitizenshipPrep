-- migrate:up

-- Foundation: helper schema, profiles, staff roles.
--
-- Target: Neon Postgres, reached by the apps through the Neon Data API.
-- The Data API provides two roles, `authenticated` (a request with a valid
-- JWT) and `anonymous` (no JWT), and auth.user_id(), which returns the JWT's
-- "sub" claim. Enable the Data API on the branch before migrating it.
--
-- Conventions used by every migration:
--   * Row Level Security is enabled in the same migration that creates a table.
--   * Privileges are granted explicitly, table by table. Each table starts
--     with a REVOKE so the result does not depend on any default privileges.
--   * Policies call the private.* helpers through a scalar subquery,
--     `(select ...)`, so Postgres evaluates them once per statement rather
--     than once per row.
--   * User ids are text: whatever the auth provider puts in "sub".
--   * Server-side code connects as the database owner, which is not subject
--     to these policies.

do $$
begin
  if to_regrole('authenticated') is null or to_regrole('anonymous') is null then
    raise exception 'Roles "authenticated" and "anonymous" are missing.'
      using hint = 'On Neon, enable the Data API for this branch. Locally, run `pnpm db:reset`.';
  end if;
  if to_regprocedure('auth.user_id()') is null then
    raise exception 'auth.user_id() is missing.'
      using hint = 'On Neon, enable the Data API for this branch. Locally, run `pnpm db:reset`.';
  end if;
end;
$$;

-- Helpers live outside the API-exposed schema so they cannot be called over
-- the Data API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

grant usage on schema public to anonymous, authenticated;

-- The signed-in user's id, or null. The one place that knows where it comes from.
create function private.current_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select auth.user_id();
$$;

revoke all on function private.current_user_id() from public;
grant execute on function private.current_user_id() to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: the public face of an account (what other learners may see).
-- Anything private about a user belongs in another table.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id text primary key default private.current_user_id() check (char_length(id) between 1 and 128),
  display_name text check (char_length(display_name) between 1 and 60),
  avatar_url text check (avatar_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public-facing account details. The app creates the row on first sign-in; every other user-owned row hangs off it, so deleting a profile deletes that user''s data.';
comment on column public.profiles.id is 'The auth provider''s user id (the JWT "sub" claim).';

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_roles: who is staff. Kept apart from profiles so that no policy on a
-- user-editable table can ever grant a role.
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('reviewer', 'admin');

create table public.user_roles (
  user_id text primary key references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by text references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now()
);

comment on table public.user_roles is
  'Staff roles. reviewer: verifies and publishes content. admin: everything a reviewer can do, plus reference data, roles and deletion.';

create index user_roles_granted_by_idx on public.user_roles (granted_by);

-- SECURITY DEFINER so policies on other tables can ask about roles without
-- the caller needing to read user_roles (and without recursing into its RLS).
create function private.has_role(required public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = private.current_user_id()
      and (role = required or role = 'admin')
  );
$$;

create function private.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.has_role('reviewer');
$$;

create function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.has_role('admin');
$$;

revoke all on function private.has_role(public.app_role) from public;
revoke all on function private.is_staff() from public;
revoke all on function private.is_admin() from public;
grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
revoke all on table public.profiles from anonymous, authenticated;
grant
  select,
  insert (id, display_name, avatar_url),
  update (display_name, avatar_url),
  delete
  on table public.profiles to authenticated;

create policy "Signed-in users can read profiles"
on public.profiles for select
to authenticated
using (true);

create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check (id = (select private.current_user_id()));

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = (select private.current_user_id()))
with check (id = (select private.current_user_id()));

-- Account deletion: removing the profile cascades to everything the user owns.
create policy "Users can delete their own profile"
on public.profiles for delete
to authenticated
using (id = (select private.current_user_id()));

alter table public.user_roles enable row level security;
revoke all on table public.user_roles from anonymous, authenticated;
grant select, insert, update, delete on table public.user_roles to authenticated;

create policy "Users can read their own role"
on public.user_roles for select
to authenticated
using (user_id = (select private.current_user_id()));

create policy "Admins can read all roles"
on public.user_roles for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can grant roles"
on public.user_roles for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can change roles"
on public.user_roles for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can revoke roles"
on public.user_roles for delete
to authenticated
using ((select private.is_admin()));

-- migrate:down

drop table public.user_roles;
drop table public.profiles;
drop function private.is_admin();
drop function private.is_staff();
drop function private.has_role(public.app_role);
drop type public.app_role;
drop function private.set_updated_at();
drop function private.current_user_id();
revoke usage on schema public from anonymous, authenticated;
