-- Only published questions are public; publishing means verifying; roles
-- cannot be self-granted.

begin;
select plan(32);

-- Arrange --------------------------------------------------------------------------
select tests.create_user('a0000000-0000-0000-0000-00000000000a', 'alice@example.test');
select tests.create_user('c0000000-0000-0000-0000-00000000000c', 'reviewer@example.test');
select tests.create_user('d0000000-0000-0000-0000-00000000000d', 'admin@example.test');

insert into public.user_roles (user_id, role) values
  ('c0000000-0000-0000-0000-00000000000c', 'reviewer'),
  ('d0000000-0000-0000-0000-00000000000d', 'admin');

insert into public.countries (iso_code, name, has_exam, exam_languages)
values ('ZZ', 'Testland', true, '{en}'), ('YY', 'Otherland', true, '{en}');

insert into public.topics (id, country_code, slug, name) values
  ('70000000-0000-0000-0000-000000000001', 'ZZ', 'topic', 'Topic'),
  ('70000000-0000-0000-0000-000000000002', 'YY', 'topic', 'Topic');

-- One question in each status. Ids end in 1..4: published, draft, in_review, retired.
insert into public.questions
  (id, country_code, topic_id, difficulty, type, correct_answer, source_url, status,
   verified_by, last_verified_at)
values
  ('10000000-0000-0000-0000-000000000001', 'ZZ', '70000000-0000-0000-0000-000000000001', 1,
   'multiple_choice', '{"keys": ["a"]}', 'https://example.test/source', 'published',
   'c0000000-0000-0000-0000-00000000000c', now()),
  ('10000000-0000-0000-0000-000000000002', 'ZZ', '70000000-0000-0000-0000-000000000001', 1,
   'multiple_choice', '{"keys": ["a"]}', 'https://example.test/source', 'draft', null, null),
  ('10000000-0000-0000-0000-000000000003', 'ZZ', '70000000-0000-0000-0000-000000000001', 1,
   'multiple_choice', '{"keys": ["a"]}', 'https://example.test/source', 'in_review', null, null),
  ('10000000-0000-0000-0000-000000000004', 'ZZ', '70000000-0000-0000-0000-000000000001', 1,
   'multiple_choice', '{"keys": ["a"]}', 'https://example.test/source', 'retired',
   'c0000000-0000-0000-0000-00000000000c', now());

-- Every question has approved wording in English. The published one also has a
-- Spanish translation that has not been reviewed yet.
insert into public.question_translations
  (question_id, locale, text, options, status, reviewed_by, reviewed_at)
select id, 'en', 'Question ' || right(id::text, 1), '[{"key": "a", "text": "A"}]', 'approved',
       'c0000000-0000-0000-0000-00000000000c', now()
from public.questions
where country_code = 'ZZ';

insert into public.question_translations (question_id, locale, text, options, translated_from)
values ('10000000-0000-0000-0000-000000000001', 'es', 'Pregunta 1',
        '[{"key": "a", "text": "A"}]', 'en');

-- Integrity rules (checked as the superuser, so RLS is not what stops them) -----------
select throws_ok(
  $$ insert into public.questions
       (country_code, topic_id, difficulty, type, correct_answer, source_url, status)
     values ('ZZ', '70000000-0000-0000-0000-000000000001', 1, 'multiple_choice',
             '{"keys": ["a"]}', 'https://example.test/source', 'published') $$,
  '23514', null,
  'a question cannot be published without verified_by and last_verified_at'
);
select throws_ok(
  $$ insert into public.questions
       (country_code, topic_id, difficulty, type, correct_answer, source_url)
     values ('ZZ', '70000000-0000-0000-0000-000000000001', 1, 'multiple_choice',
             '{"keys": ["a"]}', 'not a url') $$,
  '23514', null,
  'a question needs a real source_url'
);
select throws_ok(
  $$ insert into public.questions
       (country_code, topic_id, difficulty, type, correct_answer)
     values ('ZZ', '70000000-0000-0000-0000-000000000001', 1, 'multiple_choice',
             '{"keys": ["a"]}') $$,
  '23502', null,
  'source_url is required'
);
select throws_ok(
  $$ insert into public.questions
       (country_code, topic_id, difficulty, type, correct_answer, source_url)
     values ('ZZ', '70000000-0000-0000-0000-000000000002', 1, 'multiple_choice',
             '{"keys": ["a"]}', 'https://example.test/source') $$,
  '23503', null,
  'a question cannot be filed under another country''s topic'
);

-- Signed-out visitors ------------------------------------------------------------------
select tests.authenticate_as_anonymous();

select results_eq(
  $$ select id from public.questions where country_code = 'ZZ' $$,
  array['10000000-0000-0000-0000-000000000001'::uuid],
  'a signed-out visitor sees only the published question'
);
select is_empty(
  $$ select 1 from public.questions where status <> 'published' $$,
  'a signed-out visitor sees no unpublished question in any country'
);
select results_eq(
  $$ select t.text from public.question_translations t
     join public.questions q on q.id = t.question_id where q.country_code = 'ZZ' $$,
  array['Question 1'],
  'a signed-out visitor sees only approved wording of published questions'
);
select is_empty(
  $$ select 1 from public.question_translations where locale = 'es' $$,
  'an unreviewed translation is hidden even though its question is published'
);
select is_empty(
  $$ select 1 from public.question_translations
     where question_id = '10000000-0000-0000-0000-000000000002' $$,
  'a draft''s translation cannot be fetched directly by question id'
);
select throws_ok(
  $$ update public.questions set status = 'published' $$,
  '42501', null,
  'a signed-out visitor cannot write questions'
);

-- Ordinary signed-in user -----------------------------------------------------------------
select tests.authenticate_as('a0000000-0000-0000-0000-00000000000a');

select results_eq(
  $$ select id from public.questions where country_code = 'ZZ' $$,
  array['10000000-0000-0000-0000-000000000001'::uuid],
  'a signed-in user sees only the published question'
);
select throws_ok(
  $$ insert into public.questions
       (country_code, topic_id, difficulty, type, correct_answer, source_url)
     values ('ZZ', '70000000-0000-0000-0000-000000000001', 1, 'multiple_choice',
             '{"keys": ["a"]}', 'https://example.test/source') $$,
  '42501', null,
  'a signed-in user cannot add questions'
);
select is_empty(
  $$ update public.questions set correct_answer = '{"keys": ["b"]}' returning id $$,
  'a signed-in user cannot change any question, published or not'
);
select is_empty(
  $$ update public.question_translations set text = 'defaced' returning question_id $$,
  'a signed-in user cannot change translations'
);
select is_empty(
  'delete from public.questions returning id',
  'a signed-in user cannot delete questions'
);
select throws_ok(
  $$ insert into public.countries (iso_code, name) values ('XX', 'Nowhere') $$,
  '42501', null,
  'a signed-in user cannot add countries'
);

-- Roles cannot be self-granted
select throws_ok(
  $$ insert into public.user_roles (user_id, role)
     values ('a0000000-0000-0000-0000-00000000000a', 'admin') $$,
  '42501', null,
  'a user cannot grant themselves a role'
);
select is_empty('select 1 from public.user_roles', 'a user cannot see who is staff');

-- Reviewer ----------------------------------------------------------------------------------
select tests.authenticate_as('c0000000-0000-0000-0000-00000000000c');

select results_eq(
  $$ select count(*)::int from public.questions where country_code = 'ZZ' $$,
  array[4],
  'a reviewer sees questions in every status'
);
select results_eq(
  $$ select count(*)::int from public.question_translations t
     join public.questions q on q.id = t.question_id where q.country_code = 'ZZ' $$,
  array[5],
  'a reviewer sees every translation, reviewed or not'
);
select lives_ok(
  $$ update public.questions set status = 'published'
     where id = '10000000-0000-0000-0000-000000000003' $$,
  'a reviewer can publish a question in review'
);
select results_eq(
  $$ select verified_by, last_verified_at is not null, published_at is not null
     from public.questions where id = '10000000-0000-0000-0000-000000000003' $$,
  $$ values ('c0000000-0000-0000-0000-00000000000c', true, true) $$,
  'publishing stamps the reviewer as verifier, with the time'
);
select lives_ok(
  $$ update public.questions set correct_answer = '{"keys": ["b"]}'
     where id = '10000000-0000-0000-0000-000000000003' $$,
  'a reviewer can correct an answer'
);
select results_eq(
  $$ select version from public.questions where id = '10000000-0000-0000-0000-000000000003' $$,
  array[2],
  'changing the answer bumps the question version'
);
select is_empty(
  $$ delete from public.questions
     where id = '10000000-0000-0000-0000-000000000002' returning id $$,
  'a reviewer cannot delete questions'
);
select throws_ok(
  $$ insert into public.countries (iso_code, name) values ('XX', 'Nowhere') $$,
  '42501', null,
  'a reviewer cannot add countries'
);
select is_empty(
  $$ update public.user_roles set role = 'admin'
     where user_id = 'c0000000-0000-0000-0000-00000000000c' returning user_id $$,
  'a reviewer cannot promote themselves to admin'
);

-- Admin ---------------------------------------------------------------------------------------
select tests.authenticate_as('d0000000-0000-0000-0000-00000000000d');

select lives_ok(
  $$ insert into public.countries (iso_code, name) values ('XX', 'Nowhere') $$,
  'an admin can add countries'
);
select lives_ok(
  $$ insert into public.user_roles (user_id, role, granted_by)
     values ('a0000000-0000-0000-0000-00000000000a', 'reviewer',
             'd0000000-0000-0000-0000-00000000000d') $$,
  'an admin can grant a role'
);
select lives_ok(
  $$ delete from public.questions where id = '10000000-0000-0000-0000-000000000002' $$,
  'an admin can delete a question'
);
select is_empty(
  $$ select 1 from public.questions where id = '10000000-0000-0000-0000-000000000002' $$,
  'and the question is gone'
);

-- The newly published question is now public --------------------------------------------------
select tests.authenticate_as_anonymous();
select results_eq(
  $$ select count(*)::int from public.questions where country_code = 'ZZ' $$,
  array[2],
  'after review, the second question is visible to everyone'
);

select tests.clear_authentication();
select * from finish();
rollback;
