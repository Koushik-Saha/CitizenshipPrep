-- Rate limit counters are the server's alone; a learner's reported exam
-- result is theirs alone.

begin;
select plan(11);

select tests.create_user('a1000000-0000-0000-0000-00000000000a', 'maria@example.test');
select tests.create_user('a2000000-0000-0000-0000-00000000000a', 'minh@example.test');
select tests.create_user('ad000000-0000-0000-0000-00000000000a', 'admin@example.test');
insert into public.user_roles (user_id, role) values ('ad000000-0000-0000-0000-00000000000a', 'admin');
insert into public.countries (iso_code, name, has_exam) values ('ZZ', 'Testland', true);
insert into public.user_countries (user_id, country_code, exam_date)
values ('a1000000-0000-0000-0000-00000000000a', 'ZZ', '2026-09-01'),
       ('a2000000-0000-0000-0000-00000000000a', 'ZZ', '2026-09-01');
insert into public.rate_limits (key, window_start) values ('auth:ip:abc', '2026-10-01T00:00:00Z');

-- Rate limits ---------------------------------------------------------------------
select throws_ok(
  $$ insert into public.rate_limits (key, window_start, count) values ('k', now(), 0) $$,
  '23514', null,
  'a counter starts at one'
);

select tests.authenticate_as_anonymous();
select throws_ok(
  'select 1 from public.rate_limits',
  '42501', null,
  'a signed-out visitor cannot read the counters'
);

select tests.authenticate_as('a1000000-0000-0000-0000-00000000000a');
select is_empty(
  'select 1 from public.rate_limits',
  'a learner sees no counters'
);
select throws_ok(
  $$ delete from public.rate_limits $$,
  '42501', null,
  'and cannot reset them'
);
select throws_ok(
  $$ insert into public.rate_limits (key, window_start) values ('auth:ip:abc', now()) $$,
  '42501', null,
  'or write their own'
);

select tests.authenticate_as('ad000000-0000-0000-0000-00000000000a');
select results_eq(
  'select count from public.rate_limits',
  array[1],
  'an admin can read them'
);

-- Exam results -------------------------------------------------------------------
select tests.authenticate_as('a1000000-0000-0000-0000-00000000000a');
select lives_ok(
  $$ update public.user_countries set exam_result = 'passed', exam_result_at = now()
     where country_code = 'ZZ' $$,
  'a learner can say how their exam went'
);
select throws_ok(
  $$ update public.user_countries set exam_result = 'excellent' where country_code = 'ZZ' $$,
  '23514', null,
  'as passed or failed, nothing else'
);
select throws_ok(
  $$ update public.user_countries set exam_result_at = null where country_code = 'ZZ' $$,
  '23514', null,
  'and a result always says when it was reported'
);

select tests.authenticate_as('a2000000-0000-0000-0000-00000000000a');
select results_eq(
  'select exam_result from public.user_countries',
  array[null::text],
  'another learner sees only their own, unreported, result'
);
select is_empty(
  $$ update public.user_countries set exam_result = 'failed', exam_result_at = now()
     where user_id = 'a1000000-0000-0000-0000-00000000000a' returning 1 $$,
  'and cannot report for someone else'
);

select * from finish();
rollback;
