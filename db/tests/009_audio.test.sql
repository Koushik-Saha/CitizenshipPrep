-- Audio clips: written only by the server; staff can audit them, nobody else
-- reads them directly.

begin;
select plan(8);

select tests.create_user('a0000000-0000-0000-0000-00000000000a', 'alice@example.test');
select tests.create_user('c0000000-0000-0000-0000-00000000000c', 'reviewer@example.test');
insert into public.user_roles (user_id, role) values ('c0000000-0000-0000-0000-00000000000c', 'reviewer');

insert into public.audio_clips (id, locale, voice, char_count, content_type, byte_size, data)
values (repeat('a', 64), 'en', 'test:voice', 5, 'audio/mpeg', 3, '\x010203');

select throws_ok(
  $$ insert into public.audio_clips (id, locale, voice, char_count, content_type, byte_size, data)
     values ('not-a-hash', 'en', 'test:voice', 5, 'audio/mpeg', 3, '\x010203') $$,
  '23514', null,
  'a clip''s id is a SHA-256'
);
select throws_ok(
  $$ insert into public.audio_clips (id, locale, voice, char_count, content_type, byte_size, data)
     values (repeat('b', 64), 'en', 'test:voice', 5, 'audio/mpeg', 99, '\x010203') $$,
  '23514', null,
  'the stated size is the size of the recording'
);
select throws_ok(
  $$ insert into public.audio_clips (id, locale, voice, char_count, content_type, byte_size, data)
     values (repeat('b', 64), 'en', 'test:voice', 5, 'text/html', 3, '\x010203') $$,
  '23514', null,
  'only audio is stored'
);

select tests.authenticate_as('a0000000-0000-0000-0000-00000000000a');
select is_empty('select 1 from public.audio_clips', 'a learner cannot read clips directly');
select throws_ok(
  $$ insert into public.audio_clips (id, locale, voice, char_count, content_type, byte_size, data)
     values (repeat('c', 64), 'en', 'x', 1, 'audio/mpeg', 1, '\x01') $$,
  '42501', null,
  'or add one'
);
select throws_ok('delete from public.audio_clips', '42501', null, 'or delete them');

select tests.authenticate_as('c0000000-0000-0000-0000-00000000000c');
select results_eq('select voice from public.audio_clips', array['test:voice'], 'a reviewer can audit what was recorded');

select tests.authenticate_as_anonymous();
select throws_ok('select 1 from public.audio_clips', '42501', null, 'nor can signed-out requests');

select tests.clear_authentication();
select * from finish();
rollback;
