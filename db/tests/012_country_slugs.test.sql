-- Countries carry the slug their public pages are addressed by: taken from the
-- name when not given, unique, safe as the first part of a path, and
-- unchanged by a later rename.

begin;
select plan(9);

select is(private.slugify('United States'), 'united-states', 'a name becomes lower case words joined by hyphens');
select is(private.slugify('Côte d’Ivoire'), 'cote-d-ivoire', 'without its accents or punctuation');
select is(private.slugify('  São Tomé and Príncipe '), 'sao-tome-and-principe', 'or stray spaces');

insert into public.countries (iso_code, name, has_exam) values ('ZZ', 'Testland Republic', true);
select is(
  (select slug from public.countries where iso_code = 'ZZ'),
  'testland-republic',
  'a country added without a slug gets one from its name'
);

insert into public.countries (iso_code, name, slug, has_exam) values ('YY', 'Otherland', 'other', true);
select is(
  (select slug from public.countries where iso_code = 'YY'),
  'other',
  'a slug that is given is kept'
);

update public.countries set name = 'Testland' where iso_code = 'ZZ';
select is(
  (select slug from public.countries where iso_code = 'ZZ'),
  'testland-republic',
  'renaming a country does not move its pages'
);

select throws_ok(
  $$ insert into public.countries (iso_code, name, has_exam) values ('YX', 'Testland Republic', true) $$,
  '23505', null,
  'two countries cannot share a slug'
);
select throws_ok(
  $$ update public.countries set slug = 'es' where iso_code = 'ZZ' $$,
  '23514', null,
  'a slug is never short enough to be taken for a language prefix'
);

select tests.clear_authentication();
set local role anonymous;
select results_eq(
  $$ select slug from public.countries where iso_code = 'ZZ' $$,
  array['testland-republic'],
  'signed-out visitors can read a country''s slug'
);
reset role;

select * from finish();
rollback;
