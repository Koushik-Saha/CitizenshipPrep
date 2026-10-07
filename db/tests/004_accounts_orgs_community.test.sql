-- Profiles, subscriptions, organizations, content flags and the community.

begin;
select plan(44);

-- Arrange --------------------------------------------------------------------------
select tests.create_user('a0000000-0000-0000-0000-00000000000a', 'alice@example.test');
select tests.create_user('b0000000-0000-0000-0000-00000000000b', 'bob@example.test');
select tests.create_user('c0000000-0000-0000-0000-00000000000c', 'reviewer@example.test');

insert into public.user_roles (user_id, role)
values ('c0000000-0000-0000-0000-00000000000c', 'reviewer');

insert into public.countries (iso_code, name, has_exam) values ('ZZ', 'Testland', true);
insert into public.topics (id, country_code, slug, name)
values ('70000000-0000-0000-0000-000000000001', 'ZZ', 'topic', 'Topic');

insert into public.questions
  (id, country_code, topic_id, difficulty, type, correct_answer, source_url, status,
   verified_by, last_verified_at)
values
  ('10000000-0000-0000-0000-000000000001', 'ZZ', '70000000-0000-0000-0000-000000000001', 1,
   'multiple_choice', '{"keys": ["a"]}', 'https://example.test/source', 'published',
   'c0000000-0000-0000-0000-00000000000c', now()),
  ('10000000-0000-0000-0000-000000000002', 'ZZ', '70000000-0000-0000-0000-000000000001', 1,
   'multiple_choice', '{"keys": ["a"]}', 'https://example.test/source', 'draft', null, null);

insert into public.subscriptions (user_id, plan, status, provider, provider_subscription_id)
values ('a0000000-0000-0000-0000-00000000000a', 'pro_monthly', 'active', 'manual', 'sub_alice');

-- An organization Alice owns (the trigger adds her as owner) and a post she wrote,
-- both with known ids so the other users can be pointed at them.
insert into public.organizations (id, name, slug, created_by)
values ('0a000000-0000-0000-0000-000000000001', 'Riverside Library', 'riverside',
        'a0000000-0000-0000-0000-00000000000a');

insert into public.community_posts (id, author_id, country_code, title, body)
values ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'ZZ',
        'How long did you study?', 'I have six weeks until my test.');

-- Profiles ---------------------------------------------------------------------------
select tests.authenticate_as('e0000000-0000-0000-0000-00000000000e');

select lives_ok(
  $$ insert into public.profiles (display_name) values ('Erin') $$,
  'a newly signed-in user can create their own profile (the id defaults to them)'
);
select throws_ok(
  $$ insert into public.profiles (id, display_name)
     values ('f0000000-0000-0000-0000-00000000000f', 'Somebody else') $$,
  '42501', null,
  'but cannot create a profile for another user id'
);
select is_empty(
  $$ delete from public.profiles where display_name <> 'Erin' returning id $$,
  'a user cannot delete other people''s profiles'
);
select lives_ok(
  $$ delete from public.profiles where id = 'e0000000-0000-0000-0000-00000000000e' $$,
  'a user can delete their own profile (account deletion)'
);

select tests.authenticate_as('a0000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$ update public.profiles set display_name = 'Alice A.'
     where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  'Alice can edit her own profile'
);
select is_empty(
  $$ update public.profiles set display_name = 'hacked'
     where id = 'b0000000-0000-0000-0000-00000000000b' returning id $$,
  'Alice cannot edit Bob''s profile'
);
select throws_ok(
  $$ update public.profiles set id = 'b0000000-0000-0000-0000-00000000000b'
     where id = 'a0000000-0000-0000-0000-00000000000a' $$,
  '42501', null,
  'Alice cannot change which account her profile belongs to'
);
select results_eq(
  $$ select display_name from public.profiles
     where id = 'b0000000-0000-0000-0000-00000000000b' $$,
  array['bob'],
  'signed-in users can read other profiles (only public details are stored there)'
);

-- Subscriptions ------------------------------------------------------------------------
select results_eq(
  'select plan from public.subscriptions',
  array['pro_monthly'],
  'Alice can read her own subscription'
);
select throws_ok(
  $$ insert into public.subscriptions (user_id, plan, status, provider)
     values ('a0000000-0000-0000-0000-00000000000a', 'pro_monthly', 'active', 'manual') $$,
  '42501', null,
  'a client cannot create a subscription for itself'
);
select throws_ok(
  $$ update public.subscriptions set plan = 'pro_yearly' $$,
  '42501', null,
  'a client cannot change a subscription'
);

-- Organizations ------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.organizations (name, slug) values ('Acme School', 'acme') returning id $$,
  'Alice can create an organization and read it back in the same request'
);
select results_eq(
  $$ select count(*)::int from public.org_members
     where user_id = 'a0000000-0000-0000-0000-00000000000a' and role = 'owner' $$,
  array[2],
  'whoever creates an organization becomes its owner'
);

select tests.authenticate_as('b0000000-0000-0000-0000-00000000000b');

select is_empty('select 1 from public.subscriptions', 'Bob cannot read Alice''s subscription');
select is_empty('select 1 from public.organizations', 'Bob cannot see organizations he is not in');
select is_empty('select 1 from public.org_members', 'Bob cannot see their members');
select throws_ok(
  $$ insert into public.org_members (organization_id, user_id, role)
     values ('0a000000-0000-0000-0000-000000000001',
             'b0000000-0000-0000-0000-00000000000b', 'admin') $$,
  '42501', null,
  'Bob cannot add himself to Alice''s organization'
);

select tests.authenticate_as('a0000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$ insert into public.org_members (organization_id, user_id, invited_by)
     values ('0a000000-0000-0000-0000-000000000001',
             'b0000000-0000-0000-0000-00000000000b',
             'a0000000-0000-0000-0000-00000000000a') $$,
  'Alice, as owner, can add Bob as a member'
);

select tests.authenticate_as('b0000000-0000-0000-0000-00000000000b');
select results_eq(
  'select slug from public.organizations',
  array['riverside'],
  'Bob now sees the organization he belongs to, and only that one'
);
select results_eq(
  'select count(*)::int from public.org_members',
  array[2],
  'Bob sees his fellow members'
);
select is_empty(
  $$ update public.org_members set role = 'owner'
     where user_id = 'b0000000-0000-0000-0000-00000000000b' returning user_id $$,
  'a member cannot promote himself'
);
select is_empty(
  $$ update public.organizations set name = 'Bob''s Library' returning id $$,
  'a member cannot rename the organization'
);
select is_empty(
  $$ delete from public.org_members
     where user_id = 'a0000000-0000-0000-0000-00000000000a' returning user_id $$,
  'a member cannot remove the owner'
);

-- Content flags ----------------------------------------------------------------------------
select tests.authenticate_as('a0000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$ insert into public.content_flags (question_id, locale, reason, details)
     values ('10000000-0000-0000-0000-000000000001', 'en', 'outdated',
             'The law changed last year.') $$,
  'Alice can flag a published question'
);
select throws_ok(
  $$ insert into public.content_flags (question_id, reason)
     values ('10000000-0000-0000-0000-000000000002', 'incorrect') $$,
  '42501', null,
  'Alice cannot flag a question she is not allowed to see'
);
select throws_ok(
  $$ insert into public.content_flags (question_id, reason, status)
     values ('10000000-0000-0000-0000-000000000001', 'incorrect', 'dismissed') $$,
  '42501', null,
  'a reporter cannot set the resolution fields when flagging'
);
select is_empty(
  $$ update public.content_flags set status = 'resolved' returning id $$,
  'a reporter cannot resolve her own flag'
);

select tests.authenticate_as('b0000000-0000-0000-0000-00000000000b');
select is_empty('select 1 from public.content_flags', 'Bob cannot see Alice''s flag');

select tests.authenticate_as('c0000000-0000-0000-0000-00000000000c');
select results_eq(
  'select reason::text from public.content_flags',
  array['outdated'],
  'a reviewer sees the flag'
);
select lives_ok(
  $$ update public.content_flags set status = 'resolved', resolution_note = 'Updated.' $$,
  'a reviewer can resolve it'
);
select results_eq(
  'select resolved_by, resolved_at is not null from public.content_flags',
  $$ values ('c0000000-0000-0000-0000-00000000000c', true) $$,
  'resolving records who did it and when'
);

-- Community ----------------------------------------------------------------------------------
select tests.authenticate_as('b0000000-0000-0000-0000-00000000000b');

select results_eq(
  'select title from public.community_posts',
  array['How long did you study?'],
  'Bob can read Alice''s post'
);
select is_empty(
  $$ update public.community_posts set body = 'defaced' returning id $$,
  'Bob cannot edit Alice''s post'
);
select is_empty(
  'delete from public.community_posts returning id',
  'Bob cannot delete Alice''s post'
);
select throws_ok(
  $$ insert into public.community_posts (author_id, title, body)
     values ('a0000000-0000-0000-0000-00000000000a', 'Fake', 'Not written by Alice') $$,
  '42501', null,
  'Bob cannot post in Alice''s name'
);
select lives_ok(
  $$ insert into public.community_comments (post_id, body)
     values ('50000000-0000-0000-0000-000000000001', 'About two months.') $$,
  'Bob can comment on a post he can see'
);
select is_empty(
  $$ update public.community_posts set is_hidden = true returning id $$,
  'Bob cannot hide posts: moderation is for staff'
);

select tests.authenticate_as('c0000000-0000-0000-0000-00000000000c');
select lives_ok(
  $$ update public.community_posts set is_hidden = true
     where id = '50000000-0000-0000-0000-000000000001' $$,
  'a reviewer can hide a post'
);

select tests.authenticate_as('b0000000-0000-0000-0000-00000000000b');
select is_empty('select 1 from public.community_posts', 'a hidden post disappears for other users');
select is_empty(
  'select 1 from public.community_comments',
  'comments on a hidden post disappear with it'
);
select throws_ok(
  $$ insert into public.community_comments (post_id, body)
     values ('50000000-0000-0000-0000-000000000001', 'Still there?') $$,
  '42501', null,
  'nobody can comment on a hidden post'
);

select tests.authenticate_as('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  'select is_hidden from public.community_posts',
  array[true],
  'the author can still see her own hidden post'
);
select is_empty(
  $$ update public.community_posts set is_hidden = false returning id $$,
  'the author cannot unhide it'
);

select tests.authenticate_as_anonymous();
select throws_ok(
  'select 1 from public.community_posts',
  '42501', null,
  'the community is for signed-in users only'
);

select tests.clear_authentication();
select * from finish();
rollback;
