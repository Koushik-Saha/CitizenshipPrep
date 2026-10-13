-- migrate:up

-- The reviewers' area is entered with a normal account that holds a staff
-- role (public.user_roles), plus a second factor: a time-based code from an
-- authenticator app. This is where the second factor is kept, and where
-- everything staff do there is written down.

-- One authenticator per staff member. The secret is stored sealed with a key
-- only the server holds (AES-256-GCM), so reading this table is not enough to
-- make codes, and clients cannot read the secret at all.
create table public.staff_second_factors (
  user_id text primary key references public.profiles (id) on delete cascade,
  secret_sealed text not null check (char_length(secret_sealed) between 20 and 400),
  -- Null until the first code from the authenticator has been accepted.
  confirmed_at timestamptz,
  -- The time step of the last code accepted: a code is good once.
  last_step bigint,
  -- Sessions that began before this are over. Set when they sign out, so a
  -- copy of their session cookie stops working with the original.
  sessions_from timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.staff_second_factors is
  'The authenticator (TOTP) each staff member signs in to /admin with. Server only.';

alter table public.staff_second_factors enable row level security;
revoke all on table public.staff_second_factors from anonymous, authenticated;
-- A staff member may see that they have one, and since when. The secret and
-- the last step used are not granted to anyone.
grant select (user_id, confirmed_at, created_at)
  on table public.staff_second_factors to authenticated;

create policy "Staff can see whether they have a second factor"
on public.staff_second_factors for select
to authenticated
using (user_id = (select private.current_user_id()));

-- Who did what in the reviewers' area, and when. Written by the server with
-- every action; never changed and never deleted, which the trigger below
-- holds even the server to. No foreign key to profiles: the record outlives
-- the account.
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id text not null check (char_length(actor_id) between 1 and 200),
  actor_name text check (char_length(actor_name) <= 200),
  action text not null check (char_length(action) between 1 and 80),
  target_type text check (char_length(target_type) <= 40),
  target_id text check (char_length(target_id) <= 200),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.admin_audit_log is
  'Every action taken in /admin: who, what, on what, when. Append-only.';

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc, id desc);
create index admin_audit_log_actor_idx on public.admin_audit_log (actor_id, created_at desc);
create index admin_audit_log_target_idx on public.admin_audit_log (target_type, target_id);

create function private.admin_audit_log_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'The admin audit log is append-only.' using errcode = '42501';
end;
$$;

create trigger admin_audit_log_no_update
before update or delete on public.admin_audit_log
for each row execute function private.admin_audit_log_is_append_only();

create trigger admin_audit_log_no_truncate
before truncate on public.admin_audit_log
for each statement execute function private.admin_audit_log_is_append_only();

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from anonymous, authenticated;
grant select on table public.admin_audit_log to authenticated;

create policy "Admins can read the audit log"
on public.admin_audit_log for select
to authenticated
using ((select private.is_admin()));

-- migrate:down

drop table public.admin_audit_log;
drop function private.admin_audit_log_is_append_only();
drop table public.staff_second_factors;
