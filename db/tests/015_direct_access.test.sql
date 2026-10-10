-- What one learner can do to another's data, and to shared content, by
-- querying the tables directly with their own sign-in (the Data API) instead
-- of going through the app. Each case here was tried by hand first:
-- docs/pentest_2026-10-09.md.

begin;
select plan(17);

select tests.create_user('a1000000-0000-0000-0000-0000000000d1', 'ana@example.test');
select tests.create_user('b1000000-0000-0000-0000-0000000000d2', 'ben@example.test');
insert into public.countries (iso_code, name, has_exam) values ('ZZ', 'Testland', true);
insert into public.user_countries (user_id, country_code, is_primary)
values ('a1000000-0000-0000-0000-0000000000d1', 'ZZ', true);
insert into public.attempts (id, user_id, country_code, mode)
values ('a7000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-0000000000d1', 'ZZ', 'practice');
insert into public.subscriptions (user_id, plan, status, provider, provider_subscription_id)
values ('a1000000-0000-0000-0000-0000000000d1', 'pro_monthly', 'active', 'stripe', 'sub_direct_access');
insert into public.organizations (id, name, slug, kind, created_by)
values ('0a000000-0000-0000-0000-000000000001', 'Ana''s school', 'anas-school', 'school',
        'a1000000-0000-0000-0000-0000000000d1');
-- As the server stores them once screened: visible.
insert into public.community_posts (id, author_id, country_code, title, body)
values ('5b000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-0000000000d2', 'ZZ',
        'A harmless title', 'A harmless body that was screened.');
insert into public.community_comments (id, post_id, author_id, body)
values ('5c000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000001',
        'b1000000-0000-0000-0000-0000000000d2', 'A harmless comment.');

select tests.authenticate_as('b1000000-0000-0000-0000-0000000000d2');

-- Another learner's study and plan ---------------------------------------------------
select is_empty(
  $$ select 1 from public.attempts where user_id = 'a1000000-0000-0000-0000-0000000000d1' $$,
  'Ben cannot read Ana''s attempts'
);
select is_empty(
  $$ update public.attempts set completed_at = now()
     where id = 'a7000000-0000-0000-0000-000000000001' returning id $$,
  'Ben cannot finish Ana''s attempt'
);
select is_empty(
  $$ select 1 from public.subscriptions where user_id = 'a1000000-0000-0000-0000-0000000000d1' $$,
  'Ben cannot read Ana''s subscription'
);
select throws_ok(
  $$ insert into public.subscriptions (user_id, plan, status, provider)
     values ('b1000000-0000-0000-0000-0000000000d2', 'pro_yearly', 'active', 'stripe') $$,
  '42501', null, 'Ben cannot give himself a subscription'
);
select throws_ok(
  $$ update public.subscriptions set user_id = 'b1000000-0000-0000-0000-0000000000d2' $$,
  '42501', null, 'Ben cannot take over Ana''s subscription'
);
select is_empty(
  $$ update public.profiles set display_name = 'owned'
     where id = 'a1000000-0000-0000-0000-0000000000d1' returning id $$,
  'Ben cannot rename Ana'
);

-- Roles and content ------------------------------------------------------------------
select throws_ok(
  $$ insert into public.user_roles (user_id, role)
     values ('b1000000-0000-0000-0000-0000000000d2', 'admin') $$,
  '42501', null, 'Ben cannot make himself an admin'
);
select is_empty(
  $$ update public.questions set status = 'published' returning id $$,
  'Ben cannot publish a question'
);

-- Another organization ---------------------------------------------------------------
select throws_ok(
  $$ insert into public.org_members (organization_id, user_id, role)
     values ('0a000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-0000000000d2', 'admin') $$,
  '42501', null, 'Ben cannot add himself to Ana''s organization'
);
select is_empty(
  $$ select 1 from public.org_members
     where organization_id = '0a000000-0000-0000-0000-000000000001' $$,
  'Ben cannot read the members of Ana''s organization'
);

-- Study groups: nothing unscreened is shown ------------------------------------------
select results_eq(
  $$ insert into public.community_posts (author_id, country_code, title, body)
     values ('b1000000-0000-0000-0000-0000000000d2', 'ZZ', 'Straight to the table', 'No screening.')
     returning is_hidden, held_for $$,
  $$ values (true, array['unscreened']) $$,
  'a post written straight to the table is held'
);
select throws_ok(
  $$ update public.community_posts set body = 'BUY PASSPORTS at evil.example'
     where id = '5b000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'Ben cannot rewrite the body of his post once it has been screened'
);
select throws_ok(
  $$ update public.community_posts set title = 'BUY PASSPORTS'
     where id = '5b000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'nor its title'
);
select throws_ok(
  $$ update public.community_comments set body = 'BUY PASSPORTS at evil.example'
     where id = '5c000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'nor a comment of his'
);

select tests.authenticate_as('a1000000-0000-0000-0000-0000000000d1');
select results_eq(
  $$ select title, body from public.community_posts
     where id = '5b000000-0000-0000-0000-000000000001' $$,
  $$ values ('A harmless title', 'A harmless body that was screened.') $$,
  'Ana still reads the post as it was screened'
);
select results_eq(
  $$ select body from public.community_comments
     where id = '5c000000-0000-0000-0000-000000000001' $$,
  $$ values ('A harmless comment.') $$,
  'and the comment'
);

-- The server (the owner) is not affected: a moderator's edit still goes through.
select tests.clear_authentication();
select lives_ok(
  $$ update public.community_posts set body = 'Edited by the server.'
     where id = '5b000000-0000-0000-0000-000000000001' $$,
  'the server can still change a post'
);

select * from finish();
rollback;
