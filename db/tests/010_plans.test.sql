-- Plans: subscriptions name a known plan, a Country Pass names its country,
-- and the billing tables are the server's alone.

begin;
select plan(11);

select tests.create_user('a0000000-0000-0000-0000-00000000000a', 'alice@example.test');
select tests.create_user('b0000000-0000-0000-0000-00000000000b', 'bob@example.test');
select tests.create_user('d0000000-0000-0000-0000-00000000000d', 'admin@example.test');
insert into public.user_roles (user_id, role) values ('d0000000-0000-0000-0000-00000000000d', 'admin');
insert into public.countries (iso_code, name, has_exam) values ('ZZ', 'Testland', true);

insert into public.subscriptions (user_id, plan, status, provider, provider_subscription_id, country_code)
values
  ('a0000000-0000-0000-0000-00000000000a', 'pro_yearly', 'active', 'stripe', 'sub_1', null),
  ('a0000000-0000-0000-0000-00000000000a', 'country_pass', 'active', 'app_store', 'tx_1', 'ZZ'),
  ('b0000000-0000-0000-0000-00000000000b', 'pro_monthly', 'active', 'play_store', 'tx_2', null);
insert into public.billing_customers (user_id, stripe_customer_id)
values ('a0000000-0000-0000-0000-00000000000a', 'cus_alice');
insert into public.billing_events (provider, event_id, event_type, user_id)
values ('stripe', 'evt_1', 'customer.subscription.updated', 'a0000000-0000-0000-0000-00000000000a');

select throws_ok(
  $$ insert into public.subscriptions (user_id, plan, status, provider, provider_subscription_id)
     values ('a0000000-0000-0000-0000-00000000000a', 'gold', 'active', 'stripe', 'sub_x') $$,
  '23514', null,
  'a subscription names a plan Oathly has'
);
select throws_ok(
  $$ insert into public.subscriptions (user_id, plan, status, provider, provider_subscription_id)
     values ('a0000000-0000-0000-0000-00000000000a', 'country_pass', 'active', 'stripe', 'pi_x') $$,
  '23514', null,
  'a Country Pass says which country it is for'
);
select throws_ok(
  $$ insert into public.subscriptions (user_id, plan, status, provider, provider_subscription_id, country_code)
     values ('a0000000-0000-0000-0000-00000000000a', 'pro_monthly', 'active', 'stripe', 'sub_y', 'ZZ') $$,
  '23514', null,
  'and Pro is not for one country'
);
select throws_ok(
  $$ insert into public.billing_events (provider, event_id, event_type) values ('stripe', 'evt_1', 'again') $$,
  '23505', null,
  'an event is recorded once'
);

select tests.authenticate_as('a0000000-0000-0000-0000-00000000000a');
select results_eq(
  $$ select plan from public.subscriptions order by plan $$,
  array['country_pass', 'pro_yearly'],
  'a learner sees what they hold, on whichever store they bought it'
);
select throws_ok(
  $$ update public.subscriptions set status = 'active', current_period_end = null $$,
  '42501', null,
  'but cannot change it'
);
select throws_ok(
  $$ insert into public.subscriptions (user_id, plan, status, provider)
     values ('a0000000-0000-0000-0000-00000000000a', 'pro_yearly', 'active', 'manual') $$,
  '42501', null,
  'or give themselves a plan'
);
select is_empty('select 1 from public.billing_customers', 'a learner cannot read billing customers');
select is_empty('select 1 from public.billing_events', 'or billing events');

select tests.authenticate_as('d0000000-0000-0000-0000-00000000000d');
select results_eq(
  'select stripe_customer_id from public.billing_customers', array['cus_alice'],
  'an admin can look up a billing customer'
);

select tests.authenticate_as_anonymous();
select throws_ok('select 1 from public.billing_events', '42501', null, 'signed-out requests see nothing');

select tests.clear_authentication();
select * from finish();
rollback;
