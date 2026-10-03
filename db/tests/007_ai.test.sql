-- AI explanations and usage: written only by the server; learners can see
-- their own usage, staff can audit explanations, nobody else sees either.

begin;
select plan(9);

select tests.create_user('a0000000-0000-0000-0000-00000000000a', 'alice@example.test');
select tests.create_user('b0000000-0000-0000-0000-00000000000b', 'bob@example.test');
select tests.create_user('c0000000-0000-0000-0000-00000000000c', 'reviewer@example.test');
insert into public.user_roles (user_id, role) values ('c0000000-0000-0000-0000-00000000000c', 'reviewer');

insert into public.countries (iso_code, name, has_exam) values ('ZZ', 'Testland', true);
insert into public.topics (id, country_code, slug, name)
values ('70000000-0000-0000-0000-000000000001', 'ZZ', 'topic', 'Topic');
insert into public.questions
  (id, country_code, topic_id, difficulty, type, correct_answer, source_url, status, verified_by, last_verified_at)
values ('10000000-0000-0000-0000-000000000001', 'ZZ', '70000000-0000-0000-0000-000000000001', 1,
        'multiple_choice', '{"keys": ["a"]}', 'https://example.test', 'published',
        'c0000000-0000-0000-0000-00000000000c', now());

insert into public.ai_explanations (question_id, question_version, locale, text, model)
values ('10000000-0000-0000-0000-000000000001', 1, 'en', 'Because.', 'test-model');
insert into public.ai_usage (user_id, feature, country_code, model, input_tokens, output_tokens) values
  ('a0000000-0000-0000-0000-00000000000a', 'tutor', 'ZZ', 'test-model', 100, 20),
  ('b0000000-0000-0000-0000-00000000000b', 'explanation', 'ZZ', 'test-model', 50, 10);

select tests.authenticate_as('a0000000-0000-0000-0000-00000000000a');
select results_eq('select input_tokens from public.ai_usage', array[100], 'a learner sees only their own AI usage');
select is_empty('select 1 from public.ai_explanations', 'a learner cannot read the explanation cache directly');
select throws_ok(
  $$ insert into public.ai_usage (user_id, feature, model, input_tokens, output_tokens)
     values ('a0000000-0000-0000-0000-00000000000a', 'tutor', 'x', 0, 0) $$,
  '42501', null,
  'a learner cannot write usage (it would reset their limit)'
);
select throws_ok(
  $$ delete from public.ai_usage $$,
  '42501', null,
  'or delete it'
);
select throws_ok(
  $$ insert into public.ai_explanations (question_id, question_version, locale, text, model)
     values ('10000000-0000-0000-0000-000000000001', 1, 'de', 'Weil.', 'x') $$,
  '42501', null,
  'a learner cannot write explanations'
);

select tests.authenticate_as('c0000000-0000-0000-0000-00000000000c');
select results_eq('select text from public.ai_explanations', array['Because.'], 'a reviewer can audit generated explanations');
select is_empty('select 1 from public.ai_usage', 'but cannot read learners’ usage');

select tests.authenticate_as_anonymous();
select throws_ok('select 1 from public.ai_usage', '42501', null, 'signed-out requests cannot touch usage');
select throws_ok('select 1 from public.ai_explanations', '42501', null, 'or explanations');

select tests.clear_authentication();
select * from finish();
rollback;
