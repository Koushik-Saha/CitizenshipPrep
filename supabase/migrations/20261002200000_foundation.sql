-- Foundation: helper schema, profiles, staff roles.
--
-- Conventions used by every migration:
--   * Row Level Security is enabled in the same migration that creates a table.
--   * Privileges are granted explicitly. Each table starts with a REVOKE so the
--     result does not depend on the project's "auto expose new tables" setting.
--   * Policies call auth.uid() and the private.* helpers through a scalar
--     subquery, `(select ...)`, so Postgres evaluates them once per statement
--     rather than once per row.

-- Helpers live outside the API-exposed schemas so they cannot be called over
-- the Data API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

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
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 60),
  avatar_url text check (avatar_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public-facing account details. One row per auth user, created by trigger.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 60), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- user_roles: who is staff. Kept apart from profiles so that no policy on a
-- user-editable table can ever grant a role.
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('reviewer', 'admin');

create table public.user_roles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
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
    where user_id = (select auth.uid())
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
grant execute on function private.has_role(public.app_role) to authenticated, service_role;
grant execute on function private.is_staff() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select, update (display_name, avatar_url) on table public.profiles to authenticated;

create policy "Signed-in users can read profiles"
on public.profiles for select
to authenticated
using (true);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

alter table public.user_roles enable row level security;
revoke all on table public.user_roles from anon, authenticated;
grant select, insert, update, delete on table public.user_roles to authenticated;

create policy "Users can read their own role"
on public.user_roles for select
to authenticated
using (user_id = (select auth.uid()));

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
