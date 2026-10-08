-- migrate:up

-- How the real exam went, as the learner reports it once their date has come.
-- It is theirs to say and to change (a retake after a fail), like the date.
alter table public.user_countries
  add column exam_result text check (exam_result in ('passed', 'failed')),
  add column exam_result_at timestamptz,
  add constraint user_countries_result_is_dated
    check ((exam_result is null) = (exam_result_at is null));

comment on column public.user_countries.exam_result is
  'Self-reported outcome of the real exam. Null until the learner says.';

-- migrate:down

alter table public.user_countries
  drop constraint user_countries_result_is_dated,
  drop column exam_result_at,
  drop column exam_result;
