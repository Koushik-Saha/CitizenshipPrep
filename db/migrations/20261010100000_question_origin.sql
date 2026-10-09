-- migrate:up

-- Where a question's wording comes from, for questions loaded from files
-- (data/questions/<ISO>/). An official question is the government's own,
-- copied from a catalogue whose licence allows it, and keeps the number the
-- catalogue gives it. A question that rests on a fact that changes (a current
-- officeholder, a figure) is marked, so the monthly check looks at it again.
alter table public.questions
  add column origin text check (origin in ('official', 'original')),
  add column official_number text check (official_number is null or origin = 'official'),
  add column source_locator text,
  add column needs_freshness_check boolean not null default false;

comment on column public.questions.origin is
  'official: the government''s own published wording. original: written by Oathly. Null for drafts made by the pipeline before this column existed.';
comment on column public.questions.source_locator is
  'Where in the source the answer is: a page, a section, a question number.';

-- migrate:down

alter table public.questions
  drop column needs_freshness_check,
  drop column source_locator,
  drop column official_number,
  drop column origin;
