-- migrate:up

-- What the quiz engine (packages/core) needs from the database.

-- The rules of an exam that its numbers cannot express: sections drawn from
-- particular topics or from the learner's region, sections where every answer
-- must be right, and examiners who stop once the result is certain. The shape
-- is validated by parseBlueprint() in packages/core.
alter table public.exam_formats
  add column blueprint jsonb check (blueprint is null or jsonb_typeof(blueprint) = 'object');

comment on column public.exam_formats.blueprint is
  'Exam structure beyond the counts, e.g. {"sections": [{"id": "values", "label": "Australian values", "count": 5, "source": {"topics": ["australian-values"]}, "mustAllBeCorrect": true}, ...], "stopEarly": false}. Null: one section, no special rules.';

-- Answers recorded offline are sent again until the server confirms them.
-- The id the app gave each answer makes those re-sends harmless.
alter table public.answer_events add column client_event_id uuid;

create unique index answer_events_client_event_idx
  on public.answer_events (user_id, client_event_id) where client_event_id is not null;

-- migrate:down

drop index public.answer_events_client_event_idx;
alter table public.answer_events drop column client_event_id;
alter table public.exam_formats drop column blueprint;
