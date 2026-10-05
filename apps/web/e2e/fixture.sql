-- End-to-end test data: a made-up country, "Testland", with published
-- questions, and a learner who has finished onboarding. Load it into a
-- scratch database only (see apps/web/e2e/README.md), never a real one.

insert into public.profiles (id, display_name) values
  ('test:reviewer', 'Test Reviewer'),
  ('test:learner', 'Lee');

insert into public.user_roles (user_id, role) values ('test:reviewer', 'reviewer');

-- Testland sits in the South Pacific, where no real country is.
insert into public.countries (iso_code, name, has_exam, exam_languages, latitude, longitude)
values ('ZZ', 'Testland', true, '{en}', -35.0, -120.0);

insert into public.exam_formats
  (country_code, slug, name, format_type, question_count, pass_mark, time_limit_minutes,
   source_url, blueprint)
values
  ('ZZ', 'written', 'Testland written test', 'written', 10, 7, 5,
   'https://example.test/testland/exam', null),
  ('ZZ', 'oral', 'Testland oral test', 'oral', 10, 6, null,
   'https://example.test/testland/exam', '{"stopEarly": true}');

insert into public.topics (id, country_code, slug, name, sort_order) values
  ('70000000-0000-4000-8000-000000000001', 'ZZ', 'government', 'Government', 1),
  ('70000000-0000-4000-8000-000000000002', 'ZZ', 'history', 'History', 2),
  ('70000000-0000-4000-8000-000000000003', 'ZZ', 'symbols', 'Symbols', 3);

-- 30 questions, 10 per topic: "What is N plus N?", correct answer 2N, with the
-- correct option rotating through a to d.
with numbered as (
  select n,
         ('70000000-0000-4000-8000-00000000000' || (1 + (n - 1) / 10))::uuid as topic_id,
         ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id,
         (array['a', 'b', 'c', 'd'])[1 + n % 4] as correct
  from generate_series(1, 30) as n
),
inserted as (
  insert into public.questions
    (id, country_code, topic_id, difficulty, type, correct_answer, source_url, status,
     verified_by, last_verified_at, source_quote)
  select id, 'ZZ', topic_id, 1 + n % 5, 'multiple_choice', jsonb_build_object('keys', jsonb_build_array(correct)),
         'https://example.test/testland/guide', 'published', 'test:reviewer', now(),
         format('%s plus %s is %s.', n, n, 2 * n)
  from numbered
  returning id
)
insert into public.question_translations
  (question_id, locale, text, options, explanation, status, reviewed_by, reviewed_at)
select q.id, 'en', format('Testland question %s: what is %s plus %s?', n, n, n),
       (select jsonb_agg(jsonb_build_object('key', key, 'text',
                 case when key = correct then (2 * n)::text else (2 * n + offset_by)::text end) order by key)
        from (values ('a', 1), ('b', 2), ('c', 3), ('d', 4)) as option (key, offset_by)),
       format('%s plus %s is %s.', n, n, 2 * n), 'approved', 'test:reviewer', now()
from numbered n
join inserted q on q.id = n.id;

-- Checked Spanish translations of the first 24 questions. The last six have
-- none, so a learner studying in Spanish sees those as the exam words them.
insert into public.question_translations
  (question_id, locale, text, options, explanation, status, translated_from, reviewed_by,
   reviewed_at)
select en.question_id, 'es',
       format('Pregunta %s de Testland: ¿cuánto es %s más %s?', n, n, n), en.options,
       format('%s más %s es %s.', n, n, 2 * n), 'approved', 'en', 'test:reviewer', now()
from generate_series(1, 24) as n
join public.question_translations en
  on en.question_id = ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
 and en.locale = 'en';

insert into public.user_settings (user_id, daily_goal_minutes, onboarded_at)
values ('test:learner', 10, now());

insert into public.user_countries (user_id, country_code, exam_date, study_locale, is_primary)
values ('test:learner', 'ZZ', current_date + 30, 'en', true);

-- A second learner who studies in Spanish, for the study/exam language switch.
insert into public.profiles (id, display_name) values ('test:estudiante', 'Ana');
insert into public.user_settings (user_id, daily_goal_minutes, onboarded_at)
values ('test:estudiante', 10, now());
insert into public.user_countries (user_id, country_code, exam_date, study_locale, is_primary)
values ('test:estudiante', 'ZZ', current_date + 30, 'es', true);

-- The Testland study guide: one passage per topic, each with some made-up
-- civic facts and the sums its questions ask about. Questions cite their
-- topic's passage, which grounds the AI explanations and the tutor.
insert into public.source_documents
  (id, country_code, title, publisher, source_url, media_type, locale, license, raw_hash,
   content_hash, byte_size)
values
  ('d0c00000-0000-4000-8000-000000000001', 'ZZ', 'Testland Citizenship Guide',
   'Testland Office of Citizenship', 'https://example.test/testland/guide', 'text/plain', 'en',
   'public-domain', repeat('a', 64), repeat('b', 64), 4000);

insert into public.source_passages (id, document_id, ordinal, heading, text, content_hash)
select ('9a550000-0000-4000-8000-00000000000' || topic)::uuid,
       'd0c00000-0000-4000-8000-000000000001', topic - 1, heading,
       intro || ' Sums used in the test: ' ||
         (select string_agg(format('%s plus %s is %s.', n, n, 2 * n), ' ')
          from generate_series(topic * 10 - 9, topic * 10) as n),
       md5(heading) || md5(intro)
from (values
  (1, 'Government',
   'Testland is governed by the Assembly of Testland, which has 40 members elected every four years. The Assembly chooses the First Minister, who leads the government. Every citizen aged 18 or over may vote.'),
  (2, 'History',
   'Testland became independent on 3 May 1921. Independence Day is celebrated every year on 3 May. The first First Minister was Ada Lindqvist.'),
  (3, 'Symbols',
   'The flag of Testland is green and white with a blue star in the centre. The national flower is the bluebell, and the national anthem is called Morning Over Testland.')
) as passages (topic, heading, intro);

update public.questions q
set source_passage_id = ('9a550000-0000-4000-8000-00000000000' || (1 + (n - 1) / 10))::uuid
from (select id, row_number() over (order by id) as n from public.questions where country_code = 'ZZ') as numbered
where numbered.id = q.id;
