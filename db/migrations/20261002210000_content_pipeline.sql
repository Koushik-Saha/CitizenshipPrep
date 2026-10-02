-- migrate:up

-- Content pipeline: where questions come from and how they get reviewed.
--
--   source_documents / source_passages   the official guides, stored and hashed
--   questions.source_passage_id, _quote  the passage each question cites
--   question_translations.status         translations are reviewed too
--   question_reviews                     who decided what, and why
--
-- The pipeline and the admin UI run server-side as the database owner. The
-- policies below are what a staff member gets if they come in through the
-- Data API instead; everyone else gets nothing from the new tables.

-- A draft a reviewer turned down. Kept (not deleted) so the same question is
-- recognised as a duplicate if it is drafted again.
alter type public.question_status add value if not exists 'rejected';

create type public.translation_status as enum ('draft', 'approved');

-- ---------------------------------------------------------------------------
-- source_documents: one row per official guide.
-- ---------------------------------------------------------------------------
create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries (iso_code) on delete restrict,
  title text not null check (char_length(title) between 1 and 300),
  publisher text check (char_length(publisher) between 1 and 200),
  -- Where the document is published. For an uploaded file, the page it came from.
  source_url text not null check (source_url ~ '^https://'),
  media_type text not null check (media_type in ('application/pdf', 'text/html', 'text/plain')),
  locale text not null check (locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  -- Why we may use it: 'public-domain', 'open-government-licence', 'permission', ...
  license text not null check (char_length(license) between 1 and 200),
  -- False for uploaded files, which the monthly check cannot fetch again.
  is_refetchable boolean not null default true,
  -- SHA-256 of the raw bytes, and of the extracted text after normalising
  -- whitespace. Only the second decides whether the source "changed": a PDF
  -- re-export changes the bytes without changing a word.
  raw_hash text not null check (raw_hash ~ '^[0-9a-f]{64}$'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  byte_size integer not null check (byte_size >= 0),
  fetched_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, source_url)
);

create trigger source_documents_set_updated_at
before update on public.source_documents
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- source_passages: the document's text, split into citable pieces. When the
-- source changes, passages that no longer appear are marked not current but
-- kept, because questions still point at them.
-- ---------------------------------------------------------------------------
create table public.source_passages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.source_documents (id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  heading text check (char_length(heading) <= 300),
  text text not null check (char_length(text) between 1 and 20000),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  is_current boolean not null default true,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint source_passages_superseded_recorded check (is_current = (superseded_at is null))
);

create unique index source_passages_current_hash_idx
  on public.source_passages (document_id, content_hash) where is_current;
create index source_passages_document_idx on public.source_passages (document_id, ordinal);

-- ---------------------------------------------------------------------------
-- questions: citation, provenance, and the two review flags.
-- ---------------------------------------------------------------------------
alter table public.questions
  add column source_passage_id uuid references public.source_passages (id) on delete restrict,
  add column source_quote text check (char_length(source_quote) between 1 and 2000),
  add column drafted_by_model text check (char_length(drafted_by_model) between 1 and 100),
  add column duplicate_of uuid references public.questions (id) on delete set null,
  add column source_changed_at timestamptz;

comment on column public.questions.source_quote is
  'Words copied exactly from the source passage that establish the correct answer.';
comment on column public.questions.drafted_by_model is
  'The model that drafted the question; null if a person wrote it.';
comment on column public.questions.duplicate_of is
  'Set at draft time when the wording closely matches an existing question.';
comment on column public.questions.source_changed_at is
  'Set when the cited passage disappears from a re-fetched source; cleared when a reviewer re-verifies.';

create index questions_source_passage_idx on public.questions (source_passage_id);
create index questions_duplicate_of_idx on public.questions (duplicate_of);
create index questions_source_changed_idx
  on public.questions (source_changed_at) where source_changed_at is not null;

-- ---------------------------------------------------------------------------
-- question_translations: each locale is reviewed before learners see it.
-- ---------------------------------------------------------------------------
alter table public.question_translations
  add column status public.translation_status not null default 'draft',
  add column translated_from text check (translated_from ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  add column drafted_by_model text check (char_length(drafted_by_model) between 1 and 100),
  add column reviewed_by text references public.profiles (id) on delete restrict,
  add column reviewed_at timestamptz,
  add constraint question_translations_approved_is_reviewed
    check (status <> 'approved' or (reviewed_by is not null and reviewed_at is not null));

comment on column public.question_translations.translated_from is
  'The locale this was translated from; null for wording written in this locale.';

create index question_translations_reviewed_by_idx on public.question_translations (reviewed_by);
create index question_translations_draft_idx
  on public.question_translations (locale) where status = 'draft';

drop policy "Anyone can read translations of published questions" on public.question_translations;

create policy "Anyone can read approved translations of published questions"
on public.question_translations for select
to anonymous, authenticated
using (
  status = 'approved'
  and exists (
    select 1
    from public.questions
    where questions.id = question_translations.question_id
      and questions.status = 'published'
  )
);

-- ---------------------------------------------------------------------------
-- question_reviews: append-only record of review decisions.
-- ---------------------------------------------------------------------------
create table public.question_reviews (
  id bigint generated always as identity primary key,
  question_id uuid not null references public.questions (id) on delete cascade,
  -- Set when the decision is about one translation, not the question itself.
  locale text check (locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  reviewer_id text default private.current_user_id() references public.profiles (id)
    on delete set null,
  action text not null check (
    action in ('approved', 'edited', 'rejected', 'reverified', 'translation_approved',
               'translation_rejected')
  ),
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index question_reviews_question_idx on public.question_reviews (question_id, created_at);
create index question_reviews_reviewer_idx on public.question_reviews (reviewer_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: staff only.
-- ---------------------------------------------------------------------------
alter table public.source_documents enable row level security;
revoke all on table public.source_documents from anonymous, authenticated;
grant select, insert, update, delete on table public.source_documents to authenticated;

create policy "Staff can read source documents"
on public.source_documents for select
to authenticated
using ((select private.is_staff()));

create policy "Staff can add source documents"
on public.source_documents for insert
to authenticated
with check ((select private.is_staff()));

create policy "Staff can update source documents"
on public.source_documents for update
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "Admins can delete source documents"
on public.source_documents for delete
to authenticated
using ((select private.is_admin()));

alter table public.source_passages enable row level security;
revoke all on table public.source_passages from anonymous, authenticated;
grant select, insert, update on table public.source_passages to authenticated;

create policy "Staff can read source passages"
on public.source_passages for select
to authenticated
using ((select private.is_staff()));

create policy "Staff can add source passages"
on public.source_passages for insert
to authenticated
with check ((select private.is_staff()));

create policy "Staff can update source passages"
on public.source_passages for update
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

alter table public.question_reviews enable row level security;
revoke all on table public.question_reviews from anonymous, authenticated;
grant select, insert on table public.question_reviews to authenticated;

create policy "Staff can read review decisions"
on public.question_reviews for select
to authenticated
using ((select private.is_staff()));

create policy "Staff can record their own review decisions"
on public.question_reviews for insert
to authenticated
with check ((select private.is_staff()) and reviewer_id = (select private.current_user_id()));

-- migrate:down

-- The 'rejected' question status stays: Postgres cannot drop an enum value.

drop table public.question_reviews;

drop policy "Anyone can read approved translations of published questions"
  on public.question_translations;

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

alter table public.question_translations
  drop constraint question_translations_approved_is_reviewed,
  drop column reviewed_at,
  drop column reviewed_by,
  drop column drafted_by_model,
  drop column translated_from,
  drop column status;

alter table public.questions
  drop column source_changed_at,
  drop column duplicate_of,
  drop column drafted_by_model,
  drop column source_quote,
  drop column source_passage_id;

drop table public.source_passages;
drop table public.source_documents;
drop type public.translation_status;
