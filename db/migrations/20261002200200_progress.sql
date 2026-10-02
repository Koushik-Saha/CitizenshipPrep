-- migrate:up

-- Progress: what a learner studies and how they are doing. Every table here
-- is private to the user who owns the row. Staff roles give no access.

create type public.attempt_mode as enum ('practice', 'review', 'mock_exam');

-- ---------------------------------------------------------------------------
-- user_countries: which exams a user is studying for.
-- ---------------------------------------------------------------------------
create table public.user_countries (
  user_id text not null default private.current_user_id() references public.profiles (id) on delete cascade,
  country_code text not null references public.countries (iso_code) on delete cascade,
  -- The language the user studies in, which need not be the exam's language.
  study_locale text check (study_locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  exam_date date,
  created_at timestamptz not null default now(),
  primary key (user_id, country_code)
);

create index user_countries_country_idx on public.user_countries (country_code);

-- ---------------------------------------------------------------------------
-- mock_exams: a full timed run of one exam format with a fixed question set.
-- ---------------------------------------------------------------------------
create table public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default private.current_user_id() references public.profiles (id) on delete cascade,
  exam_format_id uuid not null references public.exam_formats (id) on delete restrict,
  question_ids uuid[] not null check (cardinality(question_ids) > 0),
  started_at timestamptz not null default now(),
  submitted_at timestamptz check (submitted_at >= started_at),
  correct_count integer check (correct_count >= 0),
  passed boolean,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index mock_exams_user_idx on public.mock_exams (user_id, started_at desc);
create index mock_exams_exam_format_idx on public.mock_exams (exam_format_id);

-- ---------------------------------------------------------------------------
-- attempts: one study session.
-- ---------------------------------------------------------------------------
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default private.current_user_id() references public.profiles (id) on delete cascade,
  country_code text not null references public.countries (iso_code) on delete restrict,
  topic_id uuid references public.topics (id) on delete set null,
  mode public.attempt_mode not null default 'practice',
  mock_exam_id uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz check (completed_at >= started_at),
  question_count integer not null default 0 check (question_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  -- Target for answer_events, so an event can only join its own user's attempt.
  unique (id, user_id),
  -- A mock-exam attempt must point at a mock exam owned by the same user.
  foreign key (mock_exam_id, user_id) references public.mock_exams (id, user_id)
    on delete cascade,
  constraint attempts_mock_exam_matches_mode check ((mode = 'mock_exam') = (mock_exam_id is not null)),
  constraint attempts_correct_within_count check (correct_count <= question_count)
);

create index attempts_user_idx on public.attempts (user_id, started_at desc);
create index attempts_country_idx on public.attempts (country_code);
create index attempts_topic_idx on public.attempts (topic_id);
create index attempts_mock_exam_idx on public.attempts (mock_exam_id, user_id);

-- ---------------------------------------------------------------------------
-- answer_events: append-only log, one row per answer. Adaptive learning and
-- mastery are computed from this.
-- ---------------------------------------------------------------------------
create table public.answer_events (
  id bigint generated always as identity primary key,
  user_id text not null default private.current_user_id() references public.profiles (id) on delete cascade,
  attempt_id uuid not null,
  -- Questions with history are retired, not deleted.
  question_id uuid not null references public.questions (id) on delete restrict,
  question_version integer not null check (question_version > 0),
  selected_answer jsonb,
  correct boolean not null,
  time_ms integer not null check (time_ms >= 0),
  created_at timestamptz not null default now(),
  foreign key (attempt_id, user_id) references public.attempts (id, user_id) on delete cascade
);

create index answer_events_user_idx on public.answer_events (user_id, created_at desc);
create index answer_events_attempt_idx on public.answer_events (attempt_id, user_id);
create index answer_events_question_idx on public.answer_events (question_id);

-- ---------------------------------------------------------------------------
-- mastery: the current estimate per user and topic.
-- ---------------------------------------------------------------------------
create table public.mastery (
  user_id text not null default private.current_user_id() references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  score numeric(5, 4) not null check (score between 0 and 1),
  answered_count integer not null default 0 check (answered_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  last_answered_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id),
  constraint mastery_correct_within_answered check (correct_count <= answered_count)
);

comment on column public.mastery.score is '0 (not learned) to 1 (mastered).';

create index mastery_topic_idx on public.mastery (topic_id);

create trigger mastery_set_updated_at
before update on public.mastery
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only, for every operation.
-- ---------------------------------------------------------------------------
alter table public.user_countries enable row level security;
revoke all on table public.user_countries from anonymous, authenticated;
grant select, insert, update, delete on table public.user_countries to authenticated;

create policy "Users can read their own study countries"
on public.user_countries for select
to authenticated
using (user_id = (select private.current_user_id()));

create policy "Users can add their own study countries"
on public.user_countries for insert
to authenticated
with check (user_id = (select private.current_user_id()));

create policy "Users can change their own study countries"
on public.user_countries for update
to authenticated
using (user_id = (select private.current_user_id()))
with check (user_id = (select private.current_user_id()));

create policy "Users can remove their own study countries"
on public.user_countries for delete
to authenticated
using (user_id = (select private.current_user_id()));

alter table public.mock_exams enable row level security;
revoke all on table public.mock_exams from anonymous, authenticated;
grant select, insert, update, delete on table public.mock_exams to authenticated;

create policy "Users can read their own mock exams"
on public.mock_exams for select
to authenticated
using (user_id = (select private.current_user_id()));

create policy "Users can start their own mock exams"
on public.mock_exams for insert
to authenticated
with check (user_id = (select private.current_user_id()));

create policy "Users can update their own mock exams"
on public.mock_exams for update
to authenticated
using (user_id = (select private.current_user_id()))
with check (user_id = (select private.current_user_id()));

create policy "Users can delete their own mock exams"
on public.mock_exams for delete
to authenticated
using (user_id = (select private.current_user_id()));

alter table public.attempts enable row level security;
revoke all on table public.attempts from anonymous, authenticated;
grant select, insert, update, delete on table public.attempts to authenticated;

create policy "Users can read their own attempts"
on public.attempts for select
to authenticated
using (user_id = (select private.current_user_id()));

create policy "Users can start their own attempts"
on public.attempts for insert
to authenticated
with check (user_id = (select private.current_user_id()));

create policy "Users can update their own attempts"
on public.attempts for update
to authenticated
using (user_id = (select private.current_user_id()))
with check (user_id = (select private.current_user_id()));

create policy "Users can delete their own attempts"
on public.attempts for delete
to authenticated
using (user_id = (select private.current_user_id()));

-- Append-only: no update or delete privilege at all. Rows go when the attempt
-- or the account is deleted.
alter table public.answer_events enable row level security;
revoke all on table public.answer_events from anonymous, authenticated;
grant select, insert on table public.answer_events to authenticated;

create policy "Users can read their own answers"
on public.answer_events for select
to authenticated
using (user_id = (select private.current_user_id()));

create policy "Users can record their own answers"
on public.answer_events for insert
to authenticated
with check (user_id = (select private.current_user_id()));

alter table public.mastery enable row level security;
revoke all on table public.mastery from anonymous, authenticated;
grant select, insert, update, delete on table public.mastery to authenticated;

create policy "Users can read their own mastery"
on public.mastery for select
to authenticated
using (user_id = (select private.current_user_id()));

create policy "Users can record their own mastery"
on public.mastery for insert
to authenticated
with check (user_id = (select private.current_user_id()));

create policy "Users can update their own mastery"
on public.mastery for update
to authenticated
using (user_id = (select private.current_user_id()))
with check (user_id = (select private.current_user_id()));

create policy "Users can delete their own mastery"
on public.mastery for delete
to authenticated
using (user_id = (select private.current_user_id()));

-- migrate:down

drop table public.mastery;
drop table public.answer_events;
drop table public.attempts;
drop table public.mock_exams;
drop table public.user_countries;
drop type public.attempt_mode;
