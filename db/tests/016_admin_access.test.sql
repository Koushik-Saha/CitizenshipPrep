-- The second factor staff sign in with is the server's alone, and the record
-- of what staff do can be added to but never changed.

begin;
select plan(16);

select tests.create_user('a1000000-0000-0000-0000-00000000000b', 'maria@example.test');
select tests.create_user('ad000000-0000-0000-0000-00000000000b', 'admin@example.test');
select tests.create_user('ae000000-0000-0000-0000-00000000000b', 'reviewer@example.test');
insert into public.user_roles (user_id, role)
values ('ad000000-0000-0000-0000-00000000000b', 'admin'),
       ('ae000000-0000-0000-0000-00000000000b', 'reviewer');
insert into public.staff_second_factors (user_id, secret_sealed, confirmed_at)
values ('ad000000-0000-0000-0000-00000000000b', 'v1.sealed-secret-for-the-test', now());
insert into public.admin_audit_log (actor_id, actor_name, action, target_type, target_id)
values ('ad000000-0000-0000-0000-00000000000b', 'Admin', 'question.approve', 'question', 'q1');

-- The audit log is append-only, even for the server ------------------------------
select throws_ok(
  $$ update public.admin_audit_log set action = 'nothing.happened' $$,
  '42501', 'The admin audit log is append-only.',
  'an entry cannot be rewritten'
);
select throws_ok(
  $$ delete from public.admin_audit_log $$,
  '42501', 'The admin audit log is append-only.',
  'or deleted'
);
select throws_ok(
  $$ truncate public.admin_audit_log $$,
  '42501', 'The admin audit log is append-only.',
  'or emptied'
);
select lives_ok(
  $$ delete from public.profiles where id = 'ad000000-0000-0000-0000-00000000000b' $$,
  'deleting the account does not need to touch the log'
);
select results_eq(
  'select count(*)::int from public.admin_audit_log',
  array[1],
  'and what they did stays on record'
);
select is_empty(
  'select 1 from public.staff_second_factors',
  'their authenticator goes with the account'
);

insert into public.profiles (id) values ('ad000000-0000-0000-0000-00000000000b');
insert into public.user_roles (user_id, role) values ('ad000000-0000-0000-0000-00000000000b', 'admin');
insert into public.staff_second_factors (user_id, secret_sealed)
values ('ad000000-0000-0000-0000-00000000000b', 'v1.sealed-secret-for-the-test');

-- Clients -------------------------------------------------------------------------
select tests.authenticate_as_anonymous();
select throws_ok(
  'select 1 from public.staff_second_factors',
  '42501', null,
  'a signed-out visitor cannot read second factors'
);
select throws_ok(
  'select 1 from public.admin_audit_log',
  '42501', null,
  'or the audit log'
);

select tests.authenticate_as('a1000000-0000-0000-0000-00000000000b');
select is_empty(
  'select user_id from public.staff_second_factors',
  'a learner sees nobody''s second factor'
);
select throws_ok(
  'select secret_sealed from public.staff_second_factors',
  '42501', null,
  'and cannot ask for a secret'
);
select is_empty(
  'select 1 from public.admin_audit_log',
  'and sees nothing in the audit log'
);
select throws_ok(
  $$ insert into public.admin_audit_log (actor_id, action) values ('someone', 'made.up') $$,
  '42501', null,
  'and cannot write to it'
);

select tests.authenticate_as('ad000000-0000-0000-0000-00000000000b');
select results_eq(
  'select confirmed_at is null from public.staff_second_factors',
  array[true],
  'a staff member can see whether they have enrolled'
);
select throws_ok(
  'select secret_sealed from public.staff_second_factors',
  '42501', null,
  'but not even an admin can read a secret'
);
select throws_ok(
  $$ update public.staff_second_factors set confirmed_at = now() $$,
  '42501', null,
  'or mark a second factor as confirmed'
);
select results_eq(
  'select action from public.admin_audit_log',
  array['question.approve'],
  'an admin can read the audit log'
);

select * from finish();
rollback;
