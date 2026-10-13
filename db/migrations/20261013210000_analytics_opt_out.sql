-- migrate:up

-- A learner can ask for their use not to be counted in product statistics.
-- The privacy policy offers this; this is where the answer is kept.
alter table public.user_settings
  add column analytics_opt_out boolean not null default false;

comment on column public.user_settings.analytics_opt_out is
  'True when the learner has asked for their use not to be counted in product statistics.';

-- migrate:down

alter table public.user_settings drop column analytics_opt_out;
