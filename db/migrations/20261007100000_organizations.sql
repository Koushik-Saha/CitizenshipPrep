-- migrate:up

-- Organizations for law firms, ESL schools and nonprofits: an admin invites
-- learners by email, assigns each a country and a target date, and follows
-- their readiness. Seats are bought through Stripe (or granted by staff), and
-- a learner holding a seat studies on Pro. An organization may put its logo
-- and colours on its learners' dashboards.
--
-- Who sees what:
--   * An organization's admins see its members and its pending invites, and
--     nobody else's.
--   * A learner sees their own membership, never another member's.
--   * The progress tables stay private to the learner. Admins read readiness
--     and activity through the server, which checks their role and reports
--     only on their own organization's learners.

create type public.org_kind as enum ('law_firm', 'school', 'nonprofit', 'other');

alter table public.organizations
  add column kind public.org_kind not null default 'other',
  -- White-label: both are optional, and the apps derive readable shades from them.
  add column brand_color text check (brand_color ~ '^#[0-9a-f]{6}$'),
  add column brand_accent text check (brand_accent ~ '^#[0-9a-f]{6}$');

comment on column public.organizations.seat_limit is
  'Seats granted by Oathly staff, on top of any bought through Stripe.';

grant insert (kind), update (kind, brand_color, brand_accent)
  on table public.organizations to authenticated;

-- ---------------------------------------------------------------------------
-- org_members: what the organization knows about a learner, and what it has
-- asked of them.
-- ---------------------------------------------------------------------------
alter table public.org_members
  -- The address the admin invited, which need not be the one the learner signs in with.
  add column email text check (email = lower(email) and char_length(email) between 3 and 254),
  -- The name the admin knows the learner by.
  add column name text check (char_length(name) between 1 and 120),
  add column country_code text references public.countries (iso_code) on delete set null,
  add column target_date date;

create index org_members_country_idx on public.org_members (country_code);

-- Joining takes the learner's consent: a membership is created only by the
-- server, when an invited learner accepts. An admin who could add any account
-- could read anyone's readiness.
drop policy "Organization admins can add members" on public.org_members;
revoke insert on table public.org_members from authenticated;
grant update (country_code, target_date, name) on table public.org_members to authenticated;

-- A learner sees their own membership; only admins see the member list.
drop policy "Members can read their organization's members" on public.org_members;
create policy "Members read their own membership, admins their organization's"
on public.org_members for select
to authenticated
using (
  user_id = (select private.current_user_id())
  or (select private.org_role_of(organization_id)) in ('owner', 'admin')
);

-- ---------------------------------------------------------------------------
-- org_invites: invitations not yet accepted. Accepting one turns it into a
-- membership and removes it; revoking one deletes it.
-- ---------------------------------------------------------------------------
create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (
    email = lower(email)
    and char_length(email) <= 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  name text check (char_length(name) between 1 and 120),
  role public.org_role not null default 'member' check (role <> 'owner'),
  country_code text references public.countries (iso_code) on delete set null,
  target_date date,
  -- SHA-256 of the token in the invitation link. The token itself is never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by text references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  unique (organization_id, email)
);

create index org_invites_email_idx on public.org_invites (email);
create index org_invites_country_idx on public.org_invites (country_code);
create index org_invites_invited_by_idx on public.org_invites (invited_by);

alter table public.org_invites enable row level security;
revoke all on table public.org_invites from anonymous, authenticated;
-- Everything but the token hash. Invites are written by the server.
grant
  select (id, organization_id, email, name, role, country_code, target_date, invited_by,
          created_at, expires_at),
  delete
  on table public.org_invites to authenticated;

create policy "Organization admins can read their organization's invites"
on public.org_invites for select
to authenticated
using ((select private.org_role_of(organization_id)) in ('owner', 'admin'));

create policy "Organization admins can revoke their organization's invites"
on public.org_invites for delete
to authenticated
using ((select private.org_role_of(organization_id)) in ('owner', 'admin'));

-- ---------------------------------------------------------------------------
-- org_logos: one small image per organization, kept beside the row so the
-- member list never carries it.
-- ---------------------------------------------------------------------------
create table public.org_logos (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  content_type text not null check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 262144),
  data bytea not null,
  -- Changes with the image, so its address can be cached for good.
  version text not null check (version ~ '^[0-9a-f]{16}$'),
  updated_at timestamptz not null default now(),
  constraint org_logos_size_matches check (octet_length(data) = byte_size)
);

alter table public.org_logos enable row level security;
revoke all on table public.org_logos from anonymous, authenticated;
grant select on table public.org_logos to authenticated;

create policy "Members can read their organization's logo"
on public.org_logos for select
to authenticated
using ((select private.org_role_of(organization_id)) is not null);

-- ---------------------------------------------------------------------------
-- Seats: an organization's subscription is the "team" plan, a number of seats.
-- ---------------------------------------------------------------------------
alter table public.subscriptions add column seats integer check (seats > 0);

-- Anything an organization was recorded as holding before seats had a plan.
update public.subscriptions s
set plan = 'team',
    seats = coalesce((select o.seat_limit from public.organizations o where o.id = s.organization_id), 1),
    country_code = null
where s.organization_id is not null;

alter table public.subscriptions
  drop constraint subscriptions_known_plan,
  add constraint subscriptions_known_plan
    check (plan in ('pro_monthly', 'pro_yearly', 'country_pass', 'team')),
  add constraint subscriptions_team_is_for_an_organization
    check ((plan = 'team') = (organization_id is not null)),
  add constraint subscriptions_team_counts_seats
    check ((plan = 'team') = (seats is not null));

-- Which Stripe customer an organization is: its own, not the admin's who paid.
create table public.org_billing_customers (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  created_at timestamptz not null default now()
);

alter table public.org_billing_customers enable row level security;
revoke all on table public.org_billing_customers from anonymous, authenticated;
grant select on table public.org_billing_customers to authenticated;

create policy "Admins can read organization billing customers"
on public.org_billing_customers for select
to authenticated
using ((select private.is_admin()));

-- migrate:down

drop table public.org_billing_customers;
delete from public.subscriptions where plan = 'team';
alter table public.subscriptions
  drop constraint subscriptions_team_counts_seats,
  drop constraint subscriptions_team_is_for_an_organization,
  drop constraint subscriptions_known_plan,
  add constraint subscriptions_known_plan
    check (plan in ('pro_monthly', 'pro_yearly', 'country_pass')),
  drop column seats;
drop table public.org_logos;
drop table public.org_invites;

drop policy "Members read their own membership, admins their organization's" on public.org_members;
create policy "Members can read their organization's members"
on public.org_members for select
to authenticated
using (
  user_id = (select private.current_user_id())
  or (select private.org_role_of(organization_id)) is not null
);
revoke update (country_code, target_date, name) on table public.org_members from authenticated;
grant insert on table public.org_members to authenticated;
create policy "Organization admins can add members"
on public.org_members for insert
to authenticated
with check (
  (select private.org_role_of(organization_id)) = 'owner'
  or ((select private.org_role_of(organization_id)) = 'admin' and role <> 'owner')
);
drop index public.org_members_country_idx;
alter table public.org_members
  drop column target_date,
  drop column country_code,
  drop column name,
  drop column email;

revoke insert (kind), update (kind, brand_color, brand_accent)
  on table public.organizations from authenticated;
alter table public.organizations
  drop column brand_accent,
  drop column brand_color,
  drop column kind;
drop type public.org_kind;
