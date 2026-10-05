-- migrate:up

-- Audio mode: recordings of questions being read aloud, made ahead of time by
-- the content pipeline (`pnpm content audio`) and served by the web app.
--
-- A clip is one piece of text read in one language, and its id is the SHA-256
-- of that language and text. Nothing here points at a question: the server
-- works out which texts a question needs said and looks the clips up by id.
-- Editing a question's wording simply asks for a different clip; the old one
-- is left behind for `pnpm content audio --prune`.
--
-- The recording itself is kept in the row. Clips are small (a sentence or
-- two), are written once, and are served with a year-long cache lifetime, so
-- the database is read only when a CDN does not already have the clip.
create table public.audio_clips (
  id text primary key check (id ~ '^[0-9a-f]{64}$'),
  locale text not null check (locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  -- Who read it: the service and its voice, e.g. "google:es-ES-Standard-A".
  voice text not null check (char_length(voice) between 1 and 200),
  -- How much text was read, for keeping an eye on what the service charges.
  char_count integer not null check (char_count > 0),
  content_type text not null check (content_type ~ '^audio/[a-z0-9.+-]+$'),
  byte_size integer not null check (byte_size between 1 and 5000000),
  data bytea not null,
  created_at timestamptz not null default now(),
  constraint audio_clips_size_matches check (octet_length(data) = byte_size)
);

comment on table public.audio_clips is
  'Recorded readings of question text, keyed by the SHA-256 of language and text.';

create index audio_clips_locale_idx on public.audio_clips (locale);

-- Row Level Security --------------------------------------------------------------

-- Written only by the server, as the database owner. Learners get clips
-- through the web app, which hands out only those a published question
-- needs; staff can look at what has been recorded.
alter table public.audio_clips enable row level security;
revoke all on table public.audio_clips from anonymous, authenticated;
grant select on table public.audio_clips to authenticated;

create policy "Staff can read recorded clips"
on public.audio_clips for select
to authenticated
using ((select private.is_staff()));

-- migrate:down

drop table public.audio_clips;
