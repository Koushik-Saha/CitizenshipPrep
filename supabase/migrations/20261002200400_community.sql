-- Community: content flags (users reporting outdated or wrong questions),
-- posts and comments.

create type public.flag_reason as enum ('outdated', 'incorrect', 'unclear', 'translation', 'other');
create type public.flag_status as enum ('open', 'resolved', 'dismissed');

-- ---------------------------------------------------------------------------
-- content_flags
-- ---------------------------------------------------------------------------
create table public.content_flags (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- The translation the user was looking at, if the problem is with the wording.
  locale text check (locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  reason public.flag_reason not null,
  details text check (char_length(details) <= 2000),
  status public.flag_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  constraint content_flags_resolution_recorded check ((status = 'open') = (resolved_at is null))
);

create index content_flags_question_idx on public.content_flags (question_id);
create index content_flags_user_idx on public.content_flags (user_id);
create index content_flags_open_idx on public.content_flags (created_at) where status = 'open';
create index content_flags_resolved_by_idx on public.content_flags (resolved_by);

-- Closing or reopening a flag records who did it and when, so staff only
-- need to set the status (and, optionally, a note).
create function private.content_flags_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'open' then
      new.resolved_at := null;
      new.resolved_by := null;
    else
      new.resolved_at := now();
      new.resolved_by := coalesce((select auth.uid()), new.resolved_by);
    end if;
  end if;
  return new;
end;
$$;

create trigger content_flags_before_update
before update on public.content_flags
for each row execute function private.content_flags_before_update();

-- ---------------------------------------------------------------------------
-- community_posts
-- ---------------------------------------------------------------------------
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Null for posts that are not about one country's exam.
  country_code text references public.countries (iso_code) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 10000),
  -- Set by staff when moderating. Hidden posts stay visible to their author.
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index community_posts_author_idx on public.community_posts (author_id);
create index community_posts_country_idx on public.community_posts (country_code, created_at desc);

create trigger community_posts_set_updated_at
before update on public.community_posts
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- community_comments
-- ---------------------------------------------------------------------------
create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  parent_comment_id uuid,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, post_id),
  -- A reply must belong to the same post as the comment it answers.
  foreign key (parent_comment_id, post_id) references public.community_comments (id, post_id)
    on delete cascade
);

create index community_comments_post_idx on public.community_comments (post_id, created_at);
create index community_comments_parent_idx
  on public.community_comments (parent_comment_id, post_id);
create index community_comments_author_idx on public.community_comments (author_id);

create trigger community_comments_set_updated_at
before update on public.community_comments
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- content_flags: reporters see their own; staff see and resolve all.
-- Column grants keep reporters from setting the resolution fields.
alter table public.content_flags enable row level security;
revoke all on table public.content_flags from anon, authenticated;
grant
  select,
  insert (question_id, user_id, locale, reason, details),
  update (status, resolved_by, resolved_at, resolution_note),
  delete
  on table public.content_flags to authenticated;

create policy "Users can read their own flags"
on public.content_flags for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Staff can read every flag"
on public.content_flags for select
to authenticated
using ((select private.is_staff()));

-- The EXISTS runs under the reporter's own access, so only questions they can
-- see (published ones) can be flagged.
create policy "Users can flag questions they can see"
on public.content_flags for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.questions where questions.id = content_flags.question_id)
);

create policy "Staff can resolve flags"
on public.content_flags for update
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "Admins can delete flags"
on public.content_flags for delete
to authenticated
using ((select private.is_admin()));

-- community_posts: signed-in users read what is not hidden, write their own.
alter table public.community_posts enable row level security;
revoke all on table public.community_posts from anon, authenticated;
grant
  select,
  insert (author_id, country_code, title, body),
  update (title, body, is_hidden),
  delete
  on table public.community_posts to authenticated;

create policy "Signed-in users can read visible posts"
on public.community_posts for select
to authenticated
using (not is_hidden or author_id = (select auth.uid()));

create policy "Staff can read every post"
on public.community_posts for select
to authenticated
using ((select private.is_staff()));

create policy "Users can write their own posts"
on public.community_posts for insert
to authenticated
with check (author_id = (select auth.uid()));

-- An author can edit a post only while it is visible, and cannot hide or
-- unhide it: is_hidden must be false before and after.
create policy "Authors can edit their own visible posts"
on public.community_posts for update
to authenticated
using (author_id = (select auth.uid()) and not is_hidden)
with check (author_id = (select auth.uid()) and not is_hidden);

create policy "Staff can moderate posts"
on public.community_posts for update
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "Authors can delete their own posts"
on public.community_posts for delete
to authenticated
using (author_id = (select auth.uid()));

create policy "Staff can delete posts"
on public.community_posts for delete
to authenticated
using ((select private.is_staff()));

-- community_comments: same rules, and a comment is only visible while its
-- post is (the EXISTS runs under the reader's access to community_posts).
alter table public.community_comments enable row level security;
revoke all on table public.community_comments from anon, authenticated;
grant
  select,
  insert (post_id, parent_comment_id, author_id, body),
  update (body, is_hidden),
  delete
  on table public.community_comments to authenticated;

create policy "Signed-in users can read visible comments"
on public.community_comments for select
to authenticated
using (
  (not is_hidden or author_id = (select auth.uid()))
  and exists (
    select 1 from public.community_posts where community_posts.id = community_comments.post_id
  )
);

create policy "Staff can read every comment"
on public.community_comments for select
to authenticated
using ((select private.is_staff()));

create policy "Users can comment on posts they can see"
on public.community_comments for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.community_posts where community_posts.id = community_comments.post_id
  )
);

create policy "Authors can edit their own visible comments"
on public.community_comments for update
to authenticated
using (author_id = (select auth.uid()) and not is_hidden)
with check (author_id = (select auth.uid()) and not is_hidden);

create policy "Staff can moderate comments"
on public.community_comments for update
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "Authors can delete their own comments"
on public.community_comments for delete
to authenticated
using (author_id = (select auth.uid()));

create policy "Staff can delete comments"
on public.community_comments for delete
to authenticated
using ((select private.is_staff()));
