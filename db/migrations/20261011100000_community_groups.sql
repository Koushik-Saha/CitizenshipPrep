-- migrate:up

-- Study groups, one per country: posts of three kinds (a discussion, a tip, an
-- "I passed" story with the exam date), upvotes, and reports. Everything is
-- screened before anyone else sees it; what is held back stays hidden until a
-- moderator has looked. A post that asks for help with the writer's own
-- immigration case is always held, and carries a notice to see a licensed
-- attorney: the community is for studying, not legal advice.

create type public.post_kind as enum ('discussion', 'tip', 'story');
create type public.report_reason as enum ('spam', 'abuse', 'legal_advice', 'off_topic', 'other');

alter table public.community_posts
  add column kind public.post_kind not null default 'discussion',
  -- When the writer sat the exam: for a story only.
  add column exam_date date,
  -- Why it is hidden: 'toxicity', 'spam', 'legal_advice', 'unscreened',
  -- 'reports', or 'removed' once a moderator has turned it down.
  add column held_for text[] not null default '{}',
  add column legal_notice boolean not null default false,
  add column reviewed_by text references public.profiles (id) on delete set null,
  add column reviewed_at timestamptz,
  add constraint community_posts_exam_date_for_stories check (exam_date is null or kind = 'story'),
  add constraint community_posts_held_is_hidden check (cardinality(held_for) = 0 or is_hidden);

alter table public.community_comments
  add column held_for text[] not null default '{}',
  add column reviewed_by text references public.profiles (id) on delete set null,
  add column reviewed_at timestamptz,
  add constraint community_comments_held_is_hidden check (cardinality(held_for) = 0 or is_hidden);

create index community_posts_held_idx on public.community_posts (created_at) where is_hidden;
create index community_posts_reviewed_by_idx on public.community_posts (reviewed_by);
create index community_comments_held_idx on public.community_comments (created_at) where is_hidden;
create index community_comments_reviewed_by_idx on public.community_comments (reviewed_by);

-- The app screens a post on the server and stores the result. Anything
-- written straight to the table by a signed-in user has not been screened, so
-- it waits for a moderator like any other held post.
create function private.community_hold_unscreened()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anonymous') and not (select private.is_staff()) then
    new.is_hidden := true;
    new.held_for := array['unscreened'];
  end if;
  return new;
end;
$$;

create trigger community_posts_hold_unscreened
before insert on public.community_posts
for each row execute function private.community_hold_unscreened();

create trigger community_comments_hold_unscreened
before insert on public.community_comments
for each row execute function private.community_hold_unscreened();

-- ---------------------------------------------------------------------------
-- community_votes: one upvote per learner per post
-- ---------------------------------------------------------------------------
create table public.community_votes (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id text not null default private.current_user_id() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index community_votes_user_idx on public.community_votes (user_id);

-- ---------------------------------------------------------------------------
-- community_reports: a learner saying a post or a comment should be looked at
-- ---------------------------------------------------------------------------
create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts (id) on delete cascade,
  comment_id uuid references public.community_comments (id) on delete cascade,
  reporter_id text not null default private.current_user_id() references public.profiles (id) on delete cascade,
  reason public.report_reason not null,
  details text check (char_length(details) <= 1000),
  status public.flag_status not null default 'open',
  resolved_by text references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint community_reports_one_target check (num_nonnulls(post_id, comment_id) = 1),
  constraint community_reports_resolution_recorded check ((status = 'open') = (resolved_at is null)),
  unique (post_id, reporter_id),
  unique (comment_id, reporter_id)
);
create index community_reports_reporter_idx on public.community_reports (reporter_id);
create index community_reports_resolved_by_idx on public.community_reports (resolved_by);
create index community_reports_open_idx on public.community_reports (created_at) where status = 'open';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Votes and reports are written by the app's server. A signed-in user can see
-- their own; staff can see reports to act on them.
alter table public.community_votes enable row level security;
revoke all on table public.community_votes from anonymous, authenticated;
grant select on table public.community_votes to authenticated;

create policy "Users can read their own votes"
on public.community_votes for select
to authenticated
using (user_id = (select private.current_user_id()));

alter table public.community_reports enable row level security;
revoke all on table public.community_reports from anonymous, authenticated;
grant select on table public.community_reports to authenticated;

create policy "Users can read their own reports"
on public.community_reports for select
to authenticated
using (reporter_id = (select private.current_user_id()));

create policy "Staff can read every report"
on public.community_reports for select
to authenticated
using ((select private.is_staff()));

-- migrate:down

drop table public.community_reports;
drop table public.community_votes;
drop trigger community_comments_hold_unscreened on public.community_comments;
drop trigger community_posts_hold_unscreened on public.community_posts;
drop function private.community_hold_unscreened();
drop index public.community_comments_held_idx;
drop index public.community_posts_held_idx;
alter table public.community_comments
  drop column reviewed_at, drop column reviewed_by, drop column held_for;
alter table public.community_posts
  drop column reviewed_at, drop column reviewed_by, drop column legal_notice,
  drop column held_for, drop column exam_date, drop column kind;
drop type public.report_reason;
drop type public.post_kind;
