-- Study settings are private, and a learner has at most one primary country.

begin;
select plan(9);

select tests.create_user('a0000000-0000-0000-0000-00000000000a', 'alice@example.test');
select tests.create_user('b0000000-0000-0000-0000-00000000000b', 'bob@example.test');
insert into public.countries (iso_code, name, has_exam) values ('ZZ', 'Testland', true), ('YY', 'Otherland', true);

select tests.authenticate_as('a0000000-0000-0000-0000-00000000000a');

select lives_ok(
  $$ insert into public.user_settings (daily_goal_minutes, onboarded_at) values (20, now()) $$,
  'a learner can save their own settings (the user id defaults to them)'
);
select throws_ok(
  $$ insert into public.user_settings (user_id, daily_goal_minutes)
     values ('b0000000-0000-0000-0000-00000000000b', 20) $$,
  '42501', null,
  'but not settings for someone else'
);
select throws_ok(
  $$ update public.user_settings set daily_goal_minutes = 2 $$,
  '23514', null,
  'the daily goal stays within 5 to 240 minutes'
);
select lives_ok(
  $$ insert into public.user_countries (country_code, is_primary) values ('ZZ', true) $$,
  'a learner can choose a primary country'
);
select throws_ok(
  $$ insert into public.user_countries (country_code, is_primary) values ('YY', true) $$,
  '23505', null,
  'and only one'
);
select lives_ok(
  $$ insert into public.user_countries (country_code) values ('YY') $$,
  'but can study several countries'
);

select tests.authenticate_as('b0000000-0000-0000-0000-00000000000b');
select is_empty('select 1 from public.user_settings', 'another learner cannot read those settings');
select is_empty(
  $$ update public.user_settings set daily_goal_minutes = 60 returning user_id $$,
  'or change them'
);

select tests.authenticate_as_anonymous();
select throws_ok('select 1 from public.user_settings', '42501', null,
  'a signed-out request cannot touch study settings');

select tests.clear_authentication();
select * from finish();
rollback;
