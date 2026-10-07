-- migrate:up

-- Plans: Pro (monthly or yearly) and the one-time Country Pass. Purchases
-- arrive from Stripe (web) and from RevenueCat (App Store and Google Play),
-- and both land in public.subscriptions, so a learner's access is the same on
-- every device. What each plan unlocks is decided in packages/core
-- (hasAccess), not here.

-- Anything recorded before the plans had names was the paid plan.
update public.subscriptions
set plan = 'pro_monthly'
where plan not in ('pro_monthly', 'pro_yearly', 'country_pass');

alter table public.subscriptions
  -- The country a Country Pass is for.
  add column country_code text references public.countries (iso_code) on delete cascade,
  -- When the payment provider said what this row now says. Providers do not
  -- promise to deliver events in order, so an older event never overwrites a
  -- newer one.
  add column provider_event_at timestamptz,
  add constraint subscriptions_known_plan
    check (plan in ('pro_monthly', 'pro_yearly', 'country_pass')),
  add constraint subscriptions_pass_has_country
    check ((plan = 'country_pass') = (country_code is not null));

create index subscriptions_country_idx on public.subscriptions (country_code);

comment on column public.subscriptions.current_period_end is
  'When the paid period ends. Null for something with no end, like a Country Pass.';

-- Which Stripe customer a learner is, so the next checkout and the customer
-- portal find their existing payment details and subscription.
create table public.billing_customers (
  user_id text primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  created_at timestamptz not null default now()
);

-- Every webhook event handled, by the provider's own id for it. Providers
-- deliver an event more than once; the second delivery is a no-op.
create table public.billing_events (
  provider text not null check (provider in ('stripe', 'revenuecat')),
  event_id text not null check (char_length(event_id) between 1 and 255),
  event_type text not null check (char_length(event_type) between 1 and 120),
  user_id text references public.profiles (id) on delete set null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);

create index billing_events_user_idx on public.billing_events (user_id);

-- Row Level Security --------------------------------------------------------------

-- Both are written only by the server, as the database owner. Admins can
-- look; learners see what they have through public.subscriptions.
alter table public.billing_customers enable row level security;
revoke all on table public.billing_customers from anonymous, authenticated;
grant select on table public.billing_customers to authenticated;

create policy "Admins can read billing customers"
on public.billing_customers for select
to authenticated
using ((select private.is_admin()));

alter table public.billing_events enable row level security;
revoke all on table public.billing_events from anonymous, authenticated;
grant select on table public.billing_events to authenticated;

create policy "Admins can read billing events"
on public.billing_events for select
to authenticated
using ((select private.is_admin()));

-- migrate:down

drop table public.billing_events;
drop table public.billing_customers;
drop index public.subscriptions_country_idx;
alter table public.subscriptions
  drop constraint subscriptions_pass_has_country,
  drop constraint subscriptions_known_plan,
  drop column provider_event_at,
  drop column country_code;
