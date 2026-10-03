-- migrate:up

-- Onboarding: the learner's study settings, and which of their exams is the
-- one they are working towards now.
--
-- profiles stays limited to what other learners may see, so the daily goal
-- and onboarding state live in their own owner-only table.

create table public.user_settings (
  user_id text primary key default private.current_user_id()
    references public.profiles (id) on delete cascade,
  daily_goal_minutes smallint not null default 15 check (daily_goal_minutes between 5 and 240),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function private.set_updated_at();

-- A learner can study several countries; one of them is the primary one the
-- app opens on.
alter table public.user_countries
  add column is_primary boolean not null default false;

create unique index user_countries_one_primary_idx
  on public.user_countries (user_id) where is_primary;

alter table public.user_settings enable row level security;
revoke all on table public.user_settings from anonymous, authenticated;
grant select, insert (user_id, daily_goal_minutes, onboarded_at),
  update (daily_goal_minutes, onboarded_at)
  on table public.user_settings to authenticated;

create policy "Users can read their own settings"
on public.user_settings for select
to authenticated
using (user_id = (select private.current_user_id()));

create policy "Users can create their own settings"
on public.user_settings for insert
to authenticated
with check (user_id = (select private.current_user_id()));

create policy "Users can update their own settings"
on public.user_settings for update
to authenticated
using (user_id = (select private.current_user_id()))
with check (user_id = (select private.current_user_id()));

-- migrate:down

drop index public.user_countries_one_primary_idx;
alter table public.user_countries drop column is_primary;
drop table public.user_settings;
