-- migrate:up

-- Learners report problems with questions from the apps (content_flags). The
-- form offers "typo" as a reason, which the list did not have.
alter type public.flag_reason add value if not exists 'typo';

-- One open report per learner, question and reason: pressing "send" twice,
-- or reporting the same thing again before anyone has looked, adds nothing.
create unique index content_flags_one_open_idx
  on public.content_flags (question_id, user_id, reason)
  where status = 'open';

-- migrate:down

drop index public.content_flags_one_open_idx;
-- "typo" stays in flag_reason: Postgres cannot take a value out of an enum.
