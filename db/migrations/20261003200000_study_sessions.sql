-- migrate:up

-- A study session's questions are chosen up front and loaded in one go, so
-- the attempt keeps the list (in the order they are asked).
alter table public.attempts
  add column question_ids uuid[] not null default '{}'
    check (cardinality(question_ids) <= 500);

-- Days for streaks and the daily goal are the learner's days.
alter table public.user_settings
  add column time_zone text not null default 'UTC'
    check (char_length(time_zone) between 1 and 64);

grant insert (time_zone), update (time_zone) on table public.user_settings to authenticated;

-- migrate:down

revoke insert (time_zone), update (time_zone) on table public.user_settings from authenticated;
alter table public.user_settings drop column time_zone;
alter table public.attempts drop column question_ids;
