-- End-to-end test data: a made-up country, "Testland", with published
-- questions, and a learner who has finished onboarding. Load it into a
-- scratch database only (see apps/web/e2e/README.md), never a real one.

insert into public.profiles (id, display_name) values
  ('test:reviewer', 'Test Reviewer'),
  ('test:learner', 'Lee');

insert into public.user_roles (user_id, role) values ('test:reviewer', 'reviewer');

insert into public.countries (iso_code, name, has_exam, exam_languages)
values ('ZZ', 'Testland', true, '{en}');

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

insert into public.user_settings (user_id, daily_goal_minutes, onboarded_at)
values ('test:learner', 10, now());

insert into public.user_countries (user_id, country_code, exam_date, study_locale, is_primary)
values ('test:learner', 'ZZ', current_date + 30, 'en', true);
