-- migrate:up

-- AI explanations and the tutor. Claude is called from the server only; these
-- tables are written there, as the database owner.

-- Generated "explain more" texts, one per question version and language, so
-- each is paid for once. Editing a question's answer bumps its version, which
-- retires the old explanations.
create table public.ai_explanations (
  question_id uuid not null references public.questions (id) on delete cascade,
  question_version integer not null check (question_version > 0),
  locale text not null check (locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  text text not null check (char_length(text) between 1 and 8000),
  model text not null,
  created_at timestamptz not null default now(),
  primary key (question_id, question_version, locale)
);

create type public.ai_feature as enum ('explanation', 'tutor');

-- Every Claude call made for a learner: what it was for and what it used.
-- Also the basis for the per-plan rate limits.
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id text not null references public.profiles (id) on delete cascade,
  feature public.ai_feature not null,
  country_code text references public.countries (iso_code) on delete set null,
  question_id uuid references public.questions (id) on delete set null,
  model text not null,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  created_at timestamptz not null default now()
);

create index ai_usage_user_feature_idx on public.ai_usage (user_id, feature, created_at desc);
create index ai_usage_question_idx on public.ai_usage (question_id);
create index ai_usage_country_idx on public.ai_usage (country_code);

-- The tutor looks up study material by keyword. 'simple' because the material
-- comes in many languages.
create index source_passages_search_idx
  on public.source_passages using gin (to_tsvector('simple', text)) where is_current;

-- Row Level Security --------------------------------------------------------------

alter table public.ai_explanations enable row level security;
revoke all on table public.ai_explanations from anonymous, authenticated;
grant select on table public.ai_explanations to authenticated;

create policy "Staff can read generated explanations"
on public.ai_explanations for select
to authenticated
using ((select private.is_staff()));

alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anonymous, authenticated;
grant select on table public.ai_usage to authenticated;

create policy "Users can read their own AI usage"
on public.ai_usage for select
to authenticated
using (user_id = (select private.current_user_id()));

create policy "Admins can read all AI usage"
on public.ai_usage for select
to authenticated
using ((select private.is_admin()));

-- migrate:down

drop index public.source_passages_search_idx;
drop table public.ai_usage;
drop type public.ai_feature;
drop table public.ai_explanations;
