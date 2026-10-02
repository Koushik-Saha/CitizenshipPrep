-- migrate:up

-- Organizations (B2B) and subscriptions.

create type public.org_role as enum ('owner', 'admin', 'member');
create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired'
);

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  seat_limit integer check (seat_limit > 0),
  created_by text default private.current_user_id() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_created_by_idx on public.organizations (created_by);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- org_members
-- ---------------------------------------------------------------------------
create table public.org_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id text not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  invited_by text references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index org_members_user_idx on public.org_members (user_id);
create index org_members_invited_by_idx on public.org_members (invited_by);

-- The caller's role in an organization, or null if they are not a member.
-- SECURITY DEFINER so org_members policies can use it without recursing.
create function private.org_role_of(org_id uuid)
returns public.org_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.org_members
  where organization_id = org_id
    and user_id = (select private.current_user_id());
$$;

revoke all on function private.org_role_of(uuid) from public;
grant execute on function private.org_role_of(uuid) to authenticated;

-- Whoever creates an organization becomes its owner.
create function private.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.org_members (organization_id, user_id, role)
    values (new.id, new.created_by, 'owner');
  end if;
  return new;
end;
$$;

create trigger on_organization_created
after insert on public.organizations
for each row execute function private.handle_new_organization();

-- ---------------------------------------------------------------------------
-- subscriptions: belongs to one user or one organization. Written only by the
-- server (payment-provider webhooks, connecting as the database owner); clients
-- can read.
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  plan text not null check (char_length(plan) between 1 and 60),
  status public.subscription_status not null,
  provider text not null check (provider in ('stripe', 'app_store', 'play_store', 'manual')),
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id),
  constraint subscriptions_one_owner check (num_nonnulls(user_id, organization_id) = 1),
  constraint subscriptions_period_order check (current_period_end >= current_period_start)
);

create index subscriptions_user_idx on public.subscriptions (user_id);
create index subscriptions_organization_idx on public.subscriptions (organization_id);

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
revoke all on table public.organizations from anonymous, authenticated;
grant select, insert (name, slug, created_by), update (name, slug), delete
  on table public.organizations to authenticated;

-- The creator clause lets `insert ... returning` succeed: the owner membership
-- row is written by an AFTER trigger, too late for the RETURNING check.
create policy "Members can read their organizations"
on public.organizations for select
to authenticated
using (
  created_by = (select private.current_user_id())
  or (select private.org_role_of(id)) is not null
);

create policy "Signed-in users can create organizations"
on public.organizations for insert
to authenticated
with check (created_by = (select private.current_user_id()));

create policy "Organization admins can update their organization"
on public.organizations for update
to authenticated
using ((select private.org_role_of(id)) in ('owner', 'admin'))
with check ((select private.org_role_of(id)) in ('owner', 'admin'));

create policy "Organization owners can delete their organization"
on public.organizations for delete
to authenticated
using ((select private.org_role_of(id)) = 'owner');

alter table public.org_members enable row level security;
revoke all on table public.org_members from anonymous, authenticated;
grant select, insert, update (role), delete on table public.org_members to authenticated;

create policy "Members can read their organization's members"
on public.org_members for select
to authenticated
using (
  user_id = (select private.current_user_id())
  or (select private.org_role_of(organization_id)) is not null
);

-- Admins manage members; only an owner can create or touch another owner.
create policy "Organization admins can add members"
on public.org_members for insert
to authenticated
with check (
  (select private.org_role_of(organization_id)) = 'owner'
  or ((select private.org_role_of(organization_id)) = 'admin' and role <> 'owner')
);

create policy "Organization admins can change member roles"
on public.org_members for update
to authenticated
using (
  (select private.org_role_of(organization_id)) = 'owner'
  or ((select private.org_role_of(organization_id)) = 'admin' and role <> 'owner')
)
with check (
  (select private.org_role_of(organization_id)) = 'owner'
  or ((select private.org_role_of(organization_id)) = 'admin' and role <> 'owner')
);

create policy "Organization admins can remove members"
on public.org_members for delete
to authenticated
using (
  (select private.org_role_of(organization_id)) = 'owner'
  or ((select private.org_role_of(organization_id)) = 'admin' and role <> 'owner')
);

create policy "Members can leave an organization"
on public.org_members for delete
to authenticated
using (user_id = (select private.current_user_id()) and role <> 'owner');

alter table public.subscriptions enable row level security;
revoke all on table public.subscriptions from anonymous, authenticated;
grant select on table public.subscriptions to authenticated;

create policy "Users can read their own subscription"
on public.subscriptions for select
to authenticated
using (user_id = (select private.current_user_id()));

create policy "Organization admins can read their organization's subscription"
on public.subscriptions for select
to authenticated
using (
  organization_id is not null
  and (select private.org_role_of(organization_id)) in ('owner', 'admin')
);

-- migrate:down

drop table public.subscriptions;
drop table public.org_members;
drop table public.organizations;
drop function private.handle_new_organization();
drop function private.org_role_of(uuid);
drop type public.subscription_status;
drop type public.org_role;
