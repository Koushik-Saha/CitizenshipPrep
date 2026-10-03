-- Countries carry a point for the landing page globe: both coordinates or
-- neither, within range, readable by signed-out visitors.

begin;
select plan(5);

select lives_ok(
  $$ insert into public.countries (iso_code, name, has_exam, latitude, longitude)
     values ('ZZ', 'Testland', true, -35, -120) $$,
  'a country can be placed on the globe'
);
select lives_ok(
  $$ insert into public.countries (iso_code, name, has_exam) values ('YY', 'Otherland', true) $$,
  'or left off it'
);
select throws_ok(
  $$ update public.countries set longitude = null where iso_code = 'ZZ' $$,
  '23514', null,
  'but not with only one coordinate'
);
select throws_ok(
  $$ update public.countries set latitude = 95 where iso_code = 'ZZ' $$,
  '23514', null,
  'and latitude stays within ±90'
);

select tests.clear_authentication();
set local role anonymous;
select results_eq(
  $$ select latitude::float8, longitude::float8 from public.countries where iso_code = 'ZZ' $$,
  $$ values (-35::float8, -120::float8) $$,
  'signed-out visitors can read where a country is'
);
reset role;

select * from finish();
rollback;
