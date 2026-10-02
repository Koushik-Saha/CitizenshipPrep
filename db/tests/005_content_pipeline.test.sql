-- Sources, review decisions and translation review: staff only, and the
-- integrity rules that keep the review trail honest.

begin;
select plan(20);

-- Arrange --------------------------------------------------------------------------
select tests.create_user('a0000000-0000-0000-0000-00000000000a', 'alice@example.test');
select tests.create_user('c0000000-0000-0000-0000-00000000000c', 'reviewer@example.test');
select tests.create_user('e0000000-0000-0000-0000-00000000000e', 'second-reviewer@example.test');

insert into public.user_roles (user_id, role) values
  ('c0000000-0000-0000-0000-00000000000c', 'reviewer'),
  ('e0000000-0000-0000-0000-00000000000e', 'reviewer');

insert into public.countries (iso_code, name, has_exam, exam_languages)
values ('ZZ', 'Testland', true, '{en}');
insert into public.topics (id, country_code, slug, name)
values ('70000000-0000-0000-0000-000000000001', 'ZZ', 'topic', 'Topic');

insert into public.source_documents
  (id, country_code, title, source_url, media_type, locale, license, raw_hash, content_hash,
   byte_size)
values
  ('d0c00000-0000-0000-0000-000000000001', 'ZZ', 'Testland Study Guide',
   'https://example.test/guide', 'text/plain', 'en', 'public-domain',
   repeat('a', 64), repeat('b', 64), 120);

insert into public.source_passages (id, document_id, ordinal, heading, text, content_hash)
values
  ('9a550000-0000-0000-0000-000000000001', 'd0c00000-0000-0000-0000-000000000001', 0,
   'Government', 'The Constitution is the supreme law of the land.', repeat('c', 64));

insert into public.questions
  (id, country_code, topic_id, difficulty, type, correct_answer, source_url, status,
   source_passage_id, source_quote, drafted_by_model)
values
  ('10000000-0000-0000-0000-000000000001', 'ZZ', '70000000-0000-0000-0000-000000000001', 1,
   'multiple_choice', '{"keys": ["a"]}', 'https://example.test/guide', 'draft',
   '9a550000-0000-0000-0000-000000000001', 'The Constitution is the supreme law of the land.',
   'test-model');

insert into public.question_translations (question_id, locale, text, options)
values ('10000000-0000-0000-0000-000000000001', 'en', 'What is the supreme law?',
        '[{"key": "a", "text": "The Constitution"}]');

-- Integrity rules (as the owner) --------------------------------------------------------
select throws_ok(
  $$ update public.question_translations set status = 'approved'
     where question_id = '10000000-0000-0000-0000-000000000001' $$,
  '23514', null,
  'a translation cannot be approved without recording who reviewed it and when'
);
select throws_ok(
  $$ insert into public.source_passages (document_id, ordinal, text, content_hash)
     values ('d0c00000-0000-0000-0000-000000000001', 1,
             'The Constitution is the supreme law of the land.', repeat('c', 64)) $$,
  '23505', null,
  'a document cannot hold the same current passage twice'
);
select throws_ok(
  $$ delete from public.source_passages where id = '9a550000-0000-0000-0000-000000000001' $$,
  '23001', null,
  'a passage that a question cites cannot be deleted'
);
select throws_ok(
  $$ update public.source_passages set is_current = false
     where id = '9a550000-0000-0000-0000-000000000001' $$,
  '23514', null,
  'a passage cannot be marked superseded without the time it happened'
);
select lives_ok(
  $$ update public.questions set status = 'rejected'
     where id = '10000000-0000-0000-0000-000000000001' $$,
  'a draft can be rejected'
);
update public.questions set status = 'draft' where id = '10000000-0000-0000-0000-000000000001';

-- Signed-out visitors and ordinary users see none of it -----------------------------------
select tests.authenticate_as_anonymous();
select throws_ok('select 1 from public.source_documents', '42501', null,
  'a signed-out request cannot touch source documents');
select throws_ok('select 1 from public.source_passages', '42501', null,
  'a signed-out request cannot touch source passages');
select throws_ok('select 1 from public.question_reviews', '42501', null,
  'a signed-out request cannot touch review decisions');

select tests.authenticate_as('a0000000-0000-0000-0000-00000000000a');
select is_empty('select 1 from public.source_documents', 'a learner cannot read source documents');
select is_empty('select 1 from public.source_passages', 'a learner cannot read source passages');
select throws_ok(
  $$ insert into public.question_reviews (question_id, action)
     values ('10000000-0000-0000-0000-000000000001', 'approved') $$,
  '42501', null,
  'a learner cannot record a review decision'
);
select is_empty(
  $$ select 1 from public.questions where id = '10000000-0000-0000-0000-000000000001' $$,
  'a learner cannot see an AI draft'
);

-- Reviewers -----------------------------------------------------------------------------------
select tests.authenticate_as('c0000000-0000-0000-0000-00000000000c');

select results_eq(
  $$ select p.text from public.source_passages p
     join public.source_documents d on d.id = p.document_id
     where d.country_code = 'ZZ' $$,
  array['The Constitution is the supreme law of the land.'],
  'a reviewer can read the source beside the question'
);
select lives_ok(
  $$ insert into public.question_reviews (question_id, action, note)
     values ('10000000-0000-0000-0000-000000000001', 'edited', 'Fixed a typo.') $$,
  'a reviewer can record a decision (the reviewer defaults to them)'
);
select throws_ok(
  $$ insert into public.question_reviews (question_id, reviewer_id, action)
     values ('10000000-0000-0000-0000-000000000001',
             'e0000000-0000-0000-0000-00000000000e', 'approved') $$,
  '42501', null,
  'a reviewer cannot record a decision in another reviewer''s name'
);
select throws_ok(
  $$ update public.question_reviews set note = 'rewritten' $$,
  '42501', null,
  'review decisions cannot be edited afterwards'
);
select throws_ok(
  $$ delete from public.question_reviews $$,
  '42501', null,
  'review decisions cannot be deleted'
);
select is_empty(
  $$ delete from public.source_documents returning id $$,
  'a reviewer cannot delete a source document'
);
select lives_ok(
  $$ update public.question_translations
     set status = 'approved', reviewed_by = 'c0000000-0000-0000-0000-00000000000c',
         reviewed_at = now()
     where question_id = '10000000-0000-0000-0000-000000000001' $$,
  'a reviewer can approve wording'
);
select lives_ok(
  $$ update public.questions set status = 'published'
     where id = '10000000-0000-0000-0000-000000000001' $$,
  'and publish the question'
);

select tests.clear_authentication();
select * from finish();
rollback;
