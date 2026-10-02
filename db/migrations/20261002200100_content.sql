-- migrate:up

-- Content: countries, exam formats, topics, questions and their translations.
-- Reference data and published questions are public; everything else is staff-only.

create type public.exam_format_type as enum ('written', 'oral', 'interview', 'language');
create type public.question_type as enum (
  'multiple_choice',
  'multi_select',
  'true_false',
  'free_response'
);
create type public.question_status as enum ('draft', 'in_review', 'published', 'retired');

-- ---------------------------------------------------------------------------
-- countries
-- ---------------------------------------------------------------------------
create table public.countries (
  iso_code text primary key check (iso_code ~ '^[A-Z]{2}$'),
  name text not null check (char_length(name) between 1 and 100),
  has_exam boolean not null default false,
  -- BCP 47 tags. An array because some exams can be taken in more than one
  -- language (Canada: English or French).
  exam_languages text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.countries.iso_code is 'ISO 3166-1 alpha-2, upper case.';
comment on column public.countries.name is
  'English name. Clients localise from iso_code (Intl.DisplayNames).';

create trigger countries_set_updated_at
before update on public.countries
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- exam_formats: a country can have several (a civics test and a language
-- test, or an old and a new version in force at the same time).
-- ---------------------------------------------------------------------------
create table public.exam_formats (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries (iso_code) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  format_type public.exam_format_type not null,
  -- Null where the format has no fixed number (an interview, for example).
  question_count integer check (question_count > 0),
  pass_mark integer check (pass_mark > 0),
  time_limit_minutes integer check (time_limit_minutes > 0),
  question_pool_size integer check (question_pool_size > 0),
  -- Rules the numbers cannot express ("all five values questions must be correct").
  notes text,
  is_current boolean not null default true,
  source_url text not null check (source_url ~ '^https://'),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, slug),
  constraint exam_formats_pass_mark_within_count
    check (pass_mark is null or question_count is null or pass_mark <= question_count)
);

comment on column public.exam_formats.pass_mark is
  'Number of correct answers needed to pass, not a percentage.';

create trigger exam_formats_set_updated_at
before update on public.exam_formats
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- topics: per country, because each exam divides its syllabus differently.
-- ---------------------------------------------------------------------------
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries (iso_code) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, slug),
  -- Lets questions reference (topic, country) together, so a question can
  -- never be filed under another country's topic.
  unique (id, country_code)
);

create trigger topics_set_updated_at
before update on public.topics
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- questions: the language-neutral part. Wording lives in question_translations.
-- ---------------------------------------------------------------------------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries (iso_code) on delete restrict,
  topic_id uuid not null,
  exam_format_id uuid references public.exam_formats (id) on delete set null,
  -- Sub-national questions (a German Bundesland, a Canadian province): ISO 3166-2.
  region_code text check (region_code ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'),
  difficulty smallint not null check (difficulty between 1 and 5),
  type public.question_type not null,
  correct_answer jsonb not null check (jsonb_typeof(correct_answer -> 'keys') = 'array'),
  source_url text not null check (source_url ~ '^https://'),
  last_verified_at timestamptz,
  verified_by text references public.profiles (id) on delete restrict,
  status public.question_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  published_at timestamptz,
  created_by text default private.current_user_id() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (topic_id, country_code) references public.topics (id, country_code)
    on delete restrict,
  -- The rule the product rests on: nothing reaches learners unverified.
  constraint questions_published_is_verified
    check (status <> 'published' or (last_verified_at is not null and verified_by is not null))
);

comment on column public.questions.correct_answer is
  '{"keys": ["b"]}: keys of the correct entries in question_translations.options. One key for multiple_choice and true_false, one or more for multi_select; for free_response the options are the accepted answers and every key is listed.';
comment on column public.questions.verified_by is
  'The reviewer who last checked the question against source_url. Set automatically when a signed-in reviewer publishes.';
comment on column public.questions.version is
  'Starts at 1 and increases whenever the answer or the question type changes.';

create index questions_country_status_idx on public.questions (country_code, status);
create index questions_topic_idx on public.questions (topic_id, country_code);
create index questions_exam_format_idx on public.questions (exam_format_id);
create index questions_verified_by_idx on public.questions (verified_by);
create index questions_created_by_idx on public.questions (created_by);

create function private.questions_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_being_published boolean := new.status = 'published';
begin
  if tg_op = 'UPDATE' then
    if new.correct_answer is distinct from old.correct_answer
      or new.type is distinct from old.type then
      new.version := old.version + 1;
    end if;
    new.updated_at := now();
    is_being_published := is_being_published and old.status <> 'published';
  end if;

  -- Publishing is the act of verifying: stamp who did it and when. Server-side
  -- writes (no signed-in user) must supply the stamps themselves, and the
  -- check constraint rejects them if they do not.
  if is_being_published then
    if (select private.current_user_id()) is not null then
      new.verified_by := (select private.current_user_id());
      new.last_verified_at := now();
    end if;
    new.published_at := now();
  end if;

  return new;
end;
$$;

create trigger questions_before_write
before insert or update on public.questions
for each row execute function private.questions_before_write();

-- ---------------------------------------------------------------------------
-- question_translations
-- ---------------------------------------------------------------------------
create table public.question_translations (
  question_id uuid not null references public.questions (id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  text text not null check (char_length(text) between 1 and 2000),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  explanation text check (char_length(explanation) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (question_id, locale)
);

comment on column public.question_translations.options is
  '[{"key": "a", "text": "..."}]. Keys are the same in every locale and are what questions.correct_answer refers to.';

create trigger question_translations_set_updated_at
before update on public.question_translations
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- countries, exam_formats: public reference data, maintained by admins.
alter table public.countries enable row level security;
revoke all on table public.countries from anonymous, authenticated;
grant select on table public.countries to anonymous, authenticated;
grant insert, update, delete on table public.countries to authenticated;

create policy "Anyone can read countries"
on public.countries for select
to anonymous, authenticated
using (true);

create policy "Admins can add countries"
on public.countries for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can change countries"
on public.countries for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can remove countries"
on public.countries for delete
to authenticated
using ((select private.is_admin()));

alter table public.exam_formats enable row level security;
revoke all on table public.exam_formats from anonymous, authenticated;
grant select on table public.exam_formats to anonymous, authenticated;
grant insert, update, delete on table public.exam_formats to authenticated;

create policy "Anyone can read exam formats"
on public.exam_formats for select
to anonymous, authenticated
using (true);

create policy "Admins can add exam formats"
on public.exam_formats for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can change exam formats"
on public.exam_formats for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can remove exam formats"
on public.exam_formats for delete
to authenticated
using ((select private.is_admin()));

-- topics: public to read, maintained by reviewers and admins.
alter table public.topics enable row level security;
revoke all on table public.topics from anonymous, authenticated;
grant select on table public.topics to anonymous, authenticated;
grant insert, update, delete on table public.topics to authenticated;

create policy "Anyone can read topics"
on public.topics for select
to anonymous, authenticated
using (true);

create policy "Staff can add topics"
on public.topics for insert
to authenticated
with check ((select private.is_staff()));

create policy "Staff can change topics"
on public.topics for update
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "Admins can remove topics"
on public.topics for delete
to authenticated
using ((select private.is_admin()));

-- questions: only published rows are public.
alter table public.questions enable row level security;
revoke all on table public.questions from anonymous, authenticated;
grant select on table public.questions to anonymous, authenticated;
grant insert, update, delete on table public.questions to authenticated;

create policy "Anyone can read published questions"
on public.questions for select
to anonymous, authenticated
using (status = 'published');

create policy "Staff can read every question"
on public.questions for select
to authenticated
using ((select private.is_staff()));

create policy "Staff can add questions"
on public.questions for insert
to authenticated
with check ((select private.is_staff()));

create policy "Staff can change questions"
on public.questions for update
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "Admins can delete questions"
on public.questions for delete
to authenticated
using ((select private.is_admin()));

-- question_translations: visible exactly when the parent question is.
alter table public.question_translations enable row level security;
revoke all on table public.question_translations from anonymous, authenticated;
grant select on table public.question_translations to anonymous, authenticated;
grant insert, update, delete on table public.question_translations to authenticated;

create policy "Anyone can read translations of published questions"
on public.question_translations for select
to anonymous, authenticated
using (
  exists (
    select 1
    from public.questions
    where questions.id = question_translations.question_id
      and questions.status = 'published'
  )
);

create policy "Staff can read every translation"
on public.question_translations for select
to authenticated
using ((select private.is_staff()));

create policy "Staff can add translations"
on public.question_translations for insert
to authenticated
with check ((select private.is_staff()));

create policy "Staff can change translations"
on public.question_translations for update
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "Staff can delete translations"
on public.question_translations for delete
to authenticated
using ((select private.is_staff()));

-- migrate:down

drop table public.question_translations;
drop table public.questions;
drop function private.questions_before_write();
drop table public.topics;
drop table public.exam_formats;
drop table public.countries;
drop type public.question_status;
drop type public.question_type;
drop type public.exam_format_type;
