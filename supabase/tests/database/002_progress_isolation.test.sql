-- A user's progress is theirs alone: nobody else, staff included, can read or
-- change their attempts, answers, mastery, mock exams or study countries.

begin;
select plan(30);

-- Arrange (as the superuser) ------------------------------------------------
select tests.create_user('a0000000-0000-0000-0000-00000000000a', 'alice@example.test');
select tests.create_user('b0000000-0000-0000-0000-00000000000b', 'bob@example.test');
select tests.create_user('c0000000-0000-0000-0000-00000000000c', 'reviewer@example.test');
select tests.create_user('d0000000-0000-0000-0000-00000000000d', 'admin@example.test');

insert into public.user_roles (user_id, role) values
  ('c0000000-0000-0000-0000-00000000000c', 'reviewer'),
  ('d0000000-0000-0000-0000-00000000000d', 'admin');

insert into public.countries (iso_code, name, has_exam, exam_languages)
values ('ZZ', 'Testland', true, '{en}');

insert into public.exam_formats
  (id, country_code, slug, name, format_type, question_count, pass_mark, source_url)
values
  ('e0000000-0000-0000-0000-000000000001', 'ZZ', 'test', 'Test exam', 'written', 1, 1,
   'https://example.test/exam');

insert into public.topics (id, country_code, slug, name)
values ('70000000-0000-0000-0000-000000000001', 'ZZ', 'topic', 'Topic');

insert into public.questions
  (id, country_code, topic_id, difficulty, type, correct_answer, source_url, status,
   verified_by, last_verified_at)
values
  ('10000000-0000-0000-0000-000000000001', 'ZZ', '70000000-0000-0000-0000-000000000001', 1,
   'multiple_choice', '{"keys": ["a"]}', 'https://example.test/source', 'published',
   'c0000000-0000-0000-0000-00000000000c', now());

-- Alice's progress
insert into public.user_countries (user_id, country_code)
values ('a0000000-0000-0000-0000-00000000000a', 'ZZ');

insert into public.mock_exams (id, user_id, exam_format_id, question_ids)
values
  ('30000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a',
   'e0000000-0000-0000-0000-000000000001', '{10000000-0000-0000-0000-000000000001}');

insert into public.attempts (id, user_id, country_code, question_count, correct_count)
values
  ('20000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'ZZ', 1, 1);

insert into public.answer_events
  (user_id, attempt_id, question_id, question_version, correct, time_ms)
values
  ('a0000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a',
   '10000000-0000-0000-0000-000000000001', 1, true, 4200);

insert into public.mastery (user_id, topic_id, score, answered_count, correct_count)
values
  ('a0000000-0000-0000-0000-00000000000a', '70000000-0000-0000-0000-000000000001', 0.8, 1, 1);

-- Bob has one attempt of his own, so "sees nothing of Alice's" is not just "sees nothing".
insert into public.attempts (id, user_id, country_code)
values ('20000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'ZZ');

-- Bob: cannot read Alice's progress -------------------------------------------
select tests.authenticate_as('b0000000-0000-0000-0000-00000000000b');

select results_eq(
  'select id from public.attempts',
  array['20000000-0000-0000-0000-00000000000b'::uuid],
  'Bob sees only his own attempt'
);
select is_empty(
  $$ select 1 from public.attempts where user_id = 'a0000000-0000-0000-0000-00000000000a' $$,
  'Bob cannot read Alice''s attempts, even when asking for them by her id'
);
select is_empty(
  $$ select 1 from public.attempts where id = '20000000-0000-0000-0000-00000000000a' $$,
  'Bob cannot read Alice''s attempt by its own id'
);
select is_empty('select 1 from public.answer_events', 'Bob cannot read Alice''s answers');
select is_empty('select 1 from public.mastery', 'Bob cannot read Alice''s mastery');
select is_empty('select 1 from public.mock_exams', 'Bob cannot read Alice''s mock exams');
select is_empty('select 1 from public.user_countries', 'Bob cannot read Alice''s study countries');

-- Bob: cannot change or forge Alice's progress ---------------------------------
select is_empty(
  $$ update public.attempts set correct_count = 0
     where id = '20000000-0000-0000-0000-00000000000a' returning id $$,
  'Bob cannot update Alice''s attempt'
);
select is_empty(
  $$ delete from public.attempts
     where id = '20000000-0000-0000-0000-00000000000a' returning id $$,
  'Bob cannot delete Alice''s attempt'
);
select throws_ok(
  $$ insert into public.attempts (user_id, country_code)
     values ('a0000000-0000-0000-0000-00000000000a', 'ZZ') $$,
  '42501', null,
  'Bob cannot create an attempt in Alice''s name'
);
select throws_ok(
  $$ update public.attempts set user_id = 'a0000000-0000-0000-0000-00000000000a'
     where id = '20000000-0000-0000-0000-00000000000b' $$,
  '42501', null,
  'Bob cannot hand one of his attempts to Alice'
);
select throws_ok(
  $$ insert into public.answer_events
       (user_id, attempt_id, question_id, question_version, correct, time_ms)
     values ('a0000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a',
             '10000000-0000-0000-0000-000000000001', 1, false, 10) $$,
  '42501', null,
  'Bob cannot record an answer as Alice'
);
select throws_ok(
  $$ insert into public.answer_events
       (attempt_id, question_id, question_version, correct, time_ms)
     values ('20000000-0000-0000-0000-00000000000a',
             '10000000-0000-0000-0000-000000000001', 1, false, 10) $$,
  '23503', null,
  'Bob cannot attach his own answer to Alice''s attempt'
);
select throws_ok(
  $$ insert into public.mastery (user_id, topic_id, score)
     values ('a0000000-0000-0000-0000-00000000000a',
             '70000000-0000-0000-0000-000000000001', 0) $$,
  '42501', null,
  'Bob cannot write Alice''s mastery'
);
select is_empty(
  $$ update public.mastery set score = 0 returning user_id $$,
  'Bob cannot update Alice''s mastery'
);

-- Bob can still use his own ------------------------------------------------------
select lives_ok(
  $$ insert into public.answer_events (attempt_id, question_id, question_version, correct, time_ms)
     values ('20000000-0000-0000-0000-00000000000b',
             '10000000-0000-0000-0000-000000000001', 1, true, 900) $$,
  'Bob can record an answer in his own attempt (user_id defaults to him)'
);
select results_eq(
  'select count(*)::int from public.answer_events',
  array[1],
  'Bob sees his own answer and nothing else'
);
select throws_ok(
  'update public.answer_events set correct = false',
  '42501', null,
  'the answer log is append-only: no update, even of your own rows'
);
select throws_ok(
  'delete from public.answer_events',
  '42501', null,
  'the answer log is append-only: no delete, even of your own rows'
);

-- Alice: sees exactly her own -----------------------------------------------------
select tests.authenticate_as('a0000000-0000-0000-0000-00000000000a');

select results_eq(
  'select id from public.attempts',
  array['20000000-0000-0000-0000-00000000000a'::uuid],
  'Alice sees her own attempt, unchanged by Bob'
);
select results_eq(
  'select correct_count from public.attempts',
  array[1],
  'Alice''s attempt still has its original score'
);
select results_eq(
  'select time_ms from public.answer_events',
  array[4200],
  'Alice sees her own answer and not Bob''s'
);
select results_eq(
  'select score from public.mastery',
  array[0.8000::numeric(5, 4)],
  'Alice sees her own mastery'
);
select lives_ok(
  $$ update public.attempts set completed_at = now()
     where id = '20000000-0000-0000-0000-00000000000a' $$,
  'Alice can update her own attempt'
);

-- Staff roles give no access to progress --------------------------------------------
select tests.authenticate_as('c0000000-0000-0000-0000-00000000000c');
select is_empty('select 1 from public.attempts', 'a reviewer cannot read users'' attempts');
select is_empty('select 1 from public.answer_events', 'a reviewer cannot read users'' answers');

select tests.authenticate_as('d0000000-0000-0000-0000-00000000000d');
select is_empty('select 1 from public.attempts', 'an admin cannot read users'' attempts');
select is_empty('select 1 from public.mastery', 'an admin cannot read users'' mastery');

-- Signed-out requests ------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok(
  'select 1 from public.attempts',
  '42501', null,
  'a signed-out request cannot touch attempts at all'
);
select throws_ok(
  'select 1 from public.answer_events',
  '42501', null,
  'a signed-out request cannot touch answers at all'
);

select tests.clear_authentication();
select * from finish();
rollback;
