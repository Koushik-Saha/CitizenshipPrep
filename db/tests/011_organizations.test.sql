-- Organizations: an admin sees their own organization's members and invites
-- and nobody else's; members cannot see each other; a learner's progress
-- stays theirs.

begin;
select plan(33);

-- Arrange --------------------------------------------------------------------------
-- Riverside: Olivia owns it, Adam is an admin, Maria and Minh are learners.
-- Harbor: Hana owns it, Lena is a learner. Sam belongs to neither.
select tests.create_user('0a000000-0000-0000-0000-00000000000a', 'olivia@example.test');
select tests.create_user('ad000000-0000-0000-0000-00000000000a', 'adam@example.test');
select tests.create_user('a1000000-0000-0000-0000-00000000000a', 'maria@example.test');
select tests.create_user('a2000000-0000-0000-0000-00000000000a', 'minh@example.test');
select tests.create_user('0b000000-0000-0000-0000-00000000000b', 'hana@example.test');
select tests.create_user('b1000000-0000-0000-0000-00000000000b', 'lena@example.test');
select tests.create_user('50000000-0000-0000-0000-00000000000c', 'sam@example.test');
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
   'c0000000-0000-0000-0000-00000000000c', now());

insert into public.organizations (id, name, slug, kind, created_by)
values
  ('0a000000-0000-0000-0000-000000000001', 'Riverside Legal Aid', 'riverside', 'law_firm',
   '0a000000-0000-0000-0000-00000000000a'),
  ('0b000000-0000-0000-0000-000000000002', 'Harbor English School', 'harbor', 'school',
   '0b000000-0000-0000-0000-00000000000b');

insert into public.org_members (organization_id, user_id, role, email, country_code, target_date)
values
  ('0a000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-00000000000a', 'admin',
   'adam@example.test', null, null),
  ('0a000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-00000000000a', 'member',
   'maria@example.test', 'ZZ', '2027-03-01'),
  ('0a000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-00000000000a', 'member',
   'minh@example.test', 'ZZ', null),
  ('0b000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-00000000000b', 'member',
   'lena@example.test', 'ZZ', null);

insert into public.org_invites (id, organization_id, email, country_code, token_hash)
values
  ('1a000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001',
   'newcomer@example.test', 'ZZ', repeat('a', 64)),
  ('1b000000-0000-0000-0000-000000000002', '0b000000-0000-0000-0000-000000000002',
   'pupil@example.test', 'ZZ', repeat('b', 64));

insert into public.org_logos (organization_id, content_type, byte_size, data, version)
values ('0a000000-0000-0000-0000-000000000001', 'image/png', 4, '\x89504e47', repeat('0', 16));

insert into public.subscriptions
  (organization_id, plan, seats, status, provider, provider_subscription_id)
values ('0a000000-0000-0000-0000-000000000001', 'team', 5, 'active', 'stripe', 'sub_riverside');
insert into public.org_billing_customers (organization_id, stripe_customer_id)
values ('0a000000-0000-0000-0000-000000000001', 'cus_riverside');

-- Maria has studied: this is what her readiness is worked out from.
insert into public.user_countries (user_id, country_code)
values ('a1000000-0000-0000-0000-00000000000a', 'ZZ');
insert into public.attempts (id, user_id, country_code, question_count, correct_count)
values ('a7000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-00000000000a', 'ZZ', 1, 1);
insert into public.answer_events (user_id, attempt_id, question_id, question_version, correct, time_ms)
values ('a1000000-0000-0000-0000-00000000000a', 'a7000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001', 1, true, 4000);
insert into public.mastery (user_id, topic_id, score, answered_count, correct_count)
values ('a1000000-0000-0000-0000-00000000000a', '70000000-0000-0000-0000-000000000001', 0.5, 1, 1);

-- Shape ------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.subscriptions (organization_id, plan, status, provider, provider_subscription_id)
     values ('0b000000-0000-0000-0000-000000000002', 'team', 'active', 'stripe', 'sub_x') $$,
  '23514', null,
  'a team subscription says how many seats it is for'
);
select throws_ok(
  $$ insert into public.subscriptions (user_id, plan, seats, status, provider, provider_subscription_id)
     values ('50000000-0000-0000-0000-00000000000c', 'team', 3, 'active', 'stripe', 'sub_y') $$,
  '23514', null,
  'and belongs to an organization, not a person'
);
select throws_ok(
  $$ insert into public.org_invites (organization_id, email, token_hash)
     values ('0a000000-0000-0000-0000-000000000001', 'newcomer@example.test', repeat('c', 64)) $$,
  '23505', null,
  'an address is invited to an organization once'
);
select throws_ok(
  $$ insert into public.org_invites (organization_id, email, role, token_hash)
     values ('0a000000-0000-0000-0000-000000000001', 'boss@example.test', 'owner', repeat('d', 64)) $$,
  '23514', null,
  'nobody is invited to be the owner'
);

-- The owner ----------------------------------------------------------------------------
select tests.authenticate_as('0a000000-0000-0000-0000-00000000000a');

select results_eq(
  $$ select email from public.org_members where role = 'member' order by email $$,
  array['maria@example.test', 'minh@example.test'],
  'an owner sees their organization''s learners, and no other organization''s'
);
select results_eq(
  $$ select country_code, target_date::text from public.org_members
     where user_id = 'a1000000-0000-0000-0000-00000000000a' $$,
  $$ values ('ZZ', '2027-03-01') $$,
  'with the country and target date each was given'
);
select results_eq(
  'select email from public.org_invites',
  array['newcomer@example.test'],
  'an owner sees their own organization''s pending invites only'
);
select throws_ok(
  'select token_hash from public.org_invites',
  '42501', null,
  'but not what would open an invitation link'
);
select throws_ok(
  $$ insert into public.org_members (organization_id, user_id)
     values ('0a000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000c') $$,
  '42501', null,
  'an owner cannot enrol someone who has not accepted an invite'
);
select throws_ok(
  $$ insert into public.org_invites (organization_id, email, token_hash)
     values ('0a000000-0000-0000-0000-000000000001', 'x@example.test', repeat('e', 64)) $$,
  '42501', null,
  'invites are written by the server'
);
select is_empty(
  'select 1 from public.answer_events',
  'an owner cannot read a learner''s answers'
);
select is_empty(
  'select 1 from public.mastery',
  'or their mastery: readiness comes from the server, for their own learners only'
);
select is_empty(
  'select 1 from public.attempts',
  'or their study sessions'
);
select is_empty(
  'select 1 from public.user_countries',
  'or what else they study'
);
select results_eq(
  'select seats from public.subscriptions',
  array[5],
  'an owner can read how many seats the organization has'
);
select is_empty(
  'select 1 from public.org_billing_customers',
  'but not its payment customer'
);
select throws_ok(
  $$ update public.organizations set seat_limit = 500
     where id = '0a000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'and cannot grant the organization seats'
);
select lives_ok(
  $$ update public.organizations set brand_color = '#0b5fff'
     where id = '0a000000-0000-0000-0000-000000000001' $$,
  'an owner can set the organization''s colour'
);
select throws_ok(
  $$ update public.organizations set brand_color = 'red'
     where id = '0a000000-0000-0000-0000-000000000001' $$,
  '23514', null,
  'which has to be a colour'
);

-- An admin -----------------------------------------------------------------------------
select tests.authenticate_as('ad000000-0000-0000-0000-00000000000a');

select results_eq(
  'select count(*)::int from public.org_members',
  array[4],
  'an admin sees every member of their organization'
);
select lives_ok(
  $$ update public.org_members set target_date = '2027-06-01'
     where user_id = 'a2000000-0000-0000-0000-00000000000a' $$,
  'and can give a learner a target date'
);
select lives_ok(
  $$ delete from public.org_invites where id = '1a000000-0000-0000-0000-000000000001' $$,
  'and can revoke a pending invite'
);
select is_empty(
  $$ delete from public.org_invites where id = '1b000000-0000-0000-0000-000000000002'
     returning id $$,
  'but not another organization''s'
);

-- A learner ----------------------------------------------------------------------------
select tests.authenticate_as('a1000000-0000-0000-0000-00000000000a');

select results_eq(
  'select user_id from public.org_members',
  array['a1000000-0000-0000-0000-00000000000a'],
  'a learner sees their own membership and no other member'
);
select is_empty(
  'select 1 from public.org_invites',
  'a learner cannot see who else has been invited'
);
select is_empty(
  'select 1 from public.subscriptions',
  'or the organization''s subscription'
);
select is_empty(
  $$ update public.org_members set country_code = null, target_date = null returning user_id $$,
  'a learner cannot change what they were assigned'
);
select results_eq(
  'select version from public.org_logos',
  array[repeat('0', 16)],
  'a learner can load their organization''s logo'
);
select results_eq(
  'select count(*)::int from public.answer_events',
  array[1],
  'and still reads their own answers'
);

-- Another organization's owner, and an outsider -----------------------------------------
select tests.authenticate_as('0b000000-0000-0000-0000-00000000000b');

select results_eq(
  $$ select email from public.org_members where role = 'member' $$,
  array['lena@example.test'],
  'another organization''s owner sees only their own learners'
);
select is_empty(
  $$ update public.org_members set target_date = '2030-01-01'
     where user_id = 'a1000000-0000-0000-0000-00000000000a' returning user_id $$,
  'and cannot touch a learner who is not theirs'
);

select tests.authenticate_as('50000000-0000-0000-0000-00000000000c');

select is_empty(
  'select 1 from public.org_members',
  'someone in no organization sees no members'
);
select is_empty(
  'select 1 from public.org_logos',
  'and reads no organization''s logo from the table'
);

select * from finish();
rollback;
