-- Study groups: a held post is hidden from everyone but its writer and staff
-- until a moderator has looked; votes and reports are each learner's own.

begin;
select plan(15);

select tests.create_user('a1000000-0000-0000-0000-0000000000c1', 'maria@example.test');
select tests.create_user('a2000000-0000-0000-0000-0000000000c2', 'minh@example.test');
select tests.create_user('ad000000-0000-0000-0000-0000000000c3', 'moderator@example.test');
insert into public.user_roles (user_id, role) values ('ad000000-0000-0000-0000-0000000000c3', 'reviewer');
insert into public.countries (iso_code, name, has_exam) values ('ZZ', 'Testland', true);

-- As the app's server stores them, after screening: one let through, one held.
insert into public.community_posts (id, author_id, country_code, kind, title, body, exam_date)
values ('51000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-0000000000c1', 'ZZ',
        'story', 'I passed!', 'Three weeks of practice did it.', '2026-09-01');
insert into public.community_posts
  (id, author_id, country_code, title, body, is_hidden, held_for, legal_notice)
values ('51000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-0000000000c1', 'ZZ',
        'My visa was refused, can I still apply?', 'My case is complicated.', true,
        '{legal_advice}', true);
insert into public.community_votes (post_id, user_id)
values ('51000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-0000000000c2');
insert into public.community_reports (post_id, reporter_id, reason)
values ('51000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-0000000000c2', 'spam');

select throws_ok(
  $$ insert into public.community_posts (author_id, country_code, title, body, exam_date)
     values ('a1000000-0000-0000-0000-0000000000c1', 'ZZ', 'A tip', 'Read the guide.', '2026-09-01') $$,
  '23514', null,
  'only a story has an exam date'
);
select throws_ok(
  $$ insert into public.community_posts (author_id, title, body, held_for)
     values ('a1000000-0000-0000-0000-0000000000c1', 'Held', 'but showing', '{spam}') $$,
  '23514', null,
  'a post that is held is hidden'
);
select throws_ok(
  $$ insert into public.community_reports (reporter_id, reason)
     values ('a2000000-0000-0000-0000-0000000000c2', 'spam') $$,
  '23514', null,
  'a report is about a post or a comment'
);
select throws_ok(
  $$ insert into public.community_reports (post_id, reporter_id, reason)
     values ('51000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-0000000000c2', 'abuse') $$,
  '23505', null,
  'a learner reports a post once'
);

-- Another learner ----------------------------------------------------------------
select tests.authenticate_as('a2000000-0000-0000-0000-0000000000c2');
select results_eq(
  'select title from public.community_posts',
  array['I passed!'],
  'a held post is hidden from other learners'
);
select results_eq(
  'select count(*)::int from public.community_votes',
  array[1],
  'a learner sees their own vote'
);
select throws_ok(
  $$ insert into public.community_votes (post_id) values ('51000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  'votes are cast through the app, not written directly'
);
select throws_ok(
  $$ insert into public.community_reports (post_id, reason)
     values ('51000000-0000-0000-0000-000000000001', 'other') $$,
  '42501', null,
  'reports are made through the app, not written directly'
);
select lives_ok(
  $$ insert into public.community_posts (country_code, title, body)
     values ('ZZ', 'Written straight to the table', 'Not screened.') $$,
  'a learner can still write a post directly'
);
select results_eq(
  $$ select is_hidden, held_for from public.community_posts
     where title = 'Written straight to the table' $$,
  $$ values (true, array['unscreened']) $$,
  'but an unscreened post waits for a moderator'
);

-- The writer ---------------------------------------------------------------------
select tests.authenticate_as('a1000000-0000-0000-0000-0000000000c1');
select results_eq(
  'select count(*)::int from public.community_posts',
  array[2],
  'the writer still sees their own held post, and not another learner''s'
);
select is_empty('select 1 from public.community_votes', 'and not who voted for it');
select is_empty('select 1 from public.community_reports', 'nor who reported it');

-- A moderator --------------------------------------------------------------------
select tests.authenticate_as('ad000000-0000-0000-0000-0000000000c3');
select results_eq(
  'select count(*)::int from public.community_posts where is_hidden',
  array[2],
  'a moderator sees everything that is held'
);
select results_eq(
  'select reason::text from public.community_reports',
  array['spam'],
  'and the reports'
);

select * from finish();
rollback;
