import { hasAccess } from '@oathly/core';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  accessUser,
  applyRevenueCatEvent,
  applyStripeEvent,
  stripeCustomerFor,
  type RevenueCatEvent,
  type StripeEvent,
} from './billing';
import { getMe } from './me';
import {
  getCountryPack,
  getDashboard,
  loadStudySession,
  startMockExam,
  startPractice,
  StudyError,
} from './study';

// Purchases end to end against a real database: provider events in, access
// out. Needs the local database (`pnpm db:start`); skipped when the URL is
// not set. Country and user ids here are used by no other test.
const url = process.env.TEST_DATABASE_URL;
const COUNTRY = 'ZS';
const WEB = 'test:billing-web';
const PHONE = 'test:billing-phone';
const REVIEWER = 'test:billing-reviewer';
const prices = { pro_monthly: 'price_month', pro_yearly: 'price_year', country_pass: 'price_pass' };

const DAY = 86_400_000;
const now = Date.now();
const unix = (ms: number) => Math.floor(ms / 1000);

let sequence = 0;
/** A Stripe event, each a little later than the last unless told otherwise. */
function stripeEvent(type: string, object: Record<string, unknown>, at = now + ++sequence * 1000) {
  return {
    id: `evt_test_billing_${++sequence}`,
    type,
    created: unix(at),
    data: { object },
  } satisfies StripeEvent;
}

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: 'sub_test_billing_1',
  status: 'active',
  customer: 'cus_testbillingweb',
  metadata: { user_id: WEB, plan: 'pro_monthly' },
  cancel_at_period_end: false,
  current_period_start: unix(now - DAY),
  current_period_end: unix(now + 29 * DAY),
  items: { data: [{ price: { id: 'price_month' } }] },
  ...overrides,
});

function storeEvent(overrides: Partial<RevenueCatEvent>): RevenueCatEvent {
  return {
    id: `rc_test_billing_${++sequence}`,
    type: 'INITIAL_PURCHASE',
    app_user_id: PHONE,
    product_id: 'oathly_pro_yearly',
    period_type: 'NORMAL',
    store: 'APP_STORE',
    purchased_at_ms: now - DAY,
    expiration_at_ms: now + 364 * DAY,
    event_timestamp_ms: now + ++sequence * 1000,
    original_transaction_id: 'tx_test_billing_1',
    ...overrides,
  };
}

describe.skipIf(!url)('billing against the database', () => {
  let pool: pg.Pool;
  let formatId: string;
  const pro = async (userId: string, at = new Date()) =>
    hasAccess(await accessUser(pool, userId), 'all_questions', COUNTRY, at);

  async function cleanUp() {
    await pool.query('delete from public.profiles where id = any($1)', [[WEB, PHONE]]);
    await pool.query('delete from public.questions where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.profiles where id = $1', [REVIEWER]);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
    await pool.query(`delete from public.billing_events where event_id like '%test_billing%'`);
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    await pool.query('insert into public.profiles (id) values ($1), ($2), ($3)', [
      WEB,
      PHONE,
      REVIEWER,
    ]);
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages) values ($1, 'Payland', true, '{en}')`,
      [COUNTRY],
    );
    // An exam of 22 questions: more than the Free plan's sample of 20.
    formatId = (
      await pool.query<{ id: string }>(
        `insert into public.exam_formats (country_code, slug, name, format_type, question_count, pass_mark, source_url)
         values ($1, 'written', 'Payland test', 'written', 22, 15, 'https://example.test') returning id`,
        [COUNTRY],
      )
    ).rows[0]!.id;
    const topic = (
      await pool.query<{ id: string }>(
        `insert into public.topics (country_code, slug, name) values ($1, 'civics', 'Civics') returning id`,
        [COUNTRY],
      )
    ).rows[0]!.id;
    for (let i = 1; i <= 25; i += 1) {
      const id = (
        await pool.query<{ id: string }>(
          `insert into public.questions (country_code, topic_id, difficulty, type, correct_answer, source_url, status, verified_by, last_verified_at)
           values ($1, $2, 2, 'multiple_choice', '{"keys": ["a"]}', 'https://example.test', 'published', $3, now()) returning id`,
          [COUNTRY, topic, REVIEWER],
        )
      ).rows[0]!.id;
      await pool.query(
        `insert into public.question_translations (question_id, locale, text, options, status, reviewed_by, reviewed_at)
         values ($1, 'en', $2, '[{"key":"a","text":"Payland yes"},{"key":"b","text":"Payland no"}]', 'approved', $3, now())`,
        [id, `Payland question ${i}`, REVIEWER],
      );
    }
    for (const user of [WEB, PHONE]) {
      await pool.query(
        `insert into public.user_settings (user_id, daily_goal_minutes) values ($1, 10)`,
        [user],
      );
      await pool.query(
        `insert into public.user_countries (user_id, country_code, study_locale, is_primary) values ($1, $2, 'en', true)`,
        [user, COUNTRY],
      );
    }
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('gives the Free plan a sample of a country’s questions, everywhere', async () => {
    expect(await pro(WEB)).toBe(false);
    const dashboard = (await getDashboard(pool, WEB))!;
    expect(dashboard.countries[0]).toMatchObject({
      publishedQuestions: 20,
      totalQuestions: 25,
      fullAccess: false,
    });
    // The exam needs 22: more than the sample, though the country has enough.
    expect(dashboard.countries[0]!.exams[0]).toMatchObject({ locked: true });
    expect(dashboard.countries[0]!.exams[0]!.unavailableReason).toContain('Free plan');
    await expect(
      startMockExam(pool, WEB, { countryCode: COUNTRY, examFormatId: formatId }),
    ).rejects.toThrow(StudyError);

    const attempt = await startPractice(pool, WEB, {
      countryCode: COUNTRY,
      mode: 'random',
      size: 100,
    });
    const first = (await loadStudySession(pool, WEB, attempt))!.questions.map((q) => q.id).sort();
    expect(first).toHaveLength(20);
    // The same sample every time, online or in a saved pack.
    const pack = await getCountryPack(pool, WEB, COUNTRY);
    expect(pack.questions.map((q) => q.id).sort()).toEqual(first);
    expect((await getMe(pool, WEB))!.entitlements).toEqual([]);
  });

  it('turns a Stripe subscription into Pro, on every device the learner uses', async () => {
    // Checkout finishes: the learner and their Stripe customer are tied together.
    const checkout = stripeEvent('checkout.session.completed', {
      id: 'cs_test_billing_1',
      mode: 'subscription',
      client_reference_id: WEB,
      customer: 'cus_testbillingweb',
      payment_status: 'paid',
      metadata: { user_id: WEB, plan: 'pro_monthly' },
    });
    expect(await applyStripeEvent(pool, checkout, prices)).toEqual({
      kind: 'ignored',
      reason: 'nothing bought outright',
    });
    expect(await stripeCustomerFor(pool, WEB)).toBe('cus_testbillingweb');

    const created = stripeEvent('customer.subscription.created', subscription());
    expect(await applyStripeEvent(pool, created, prices)).toEqual({ kind: 'applied', userId: WEB });
    expect(await pro(WEB)).toBe(true);
    // The other learner bought nothing.
    expect(await pro(PHONE)).toBe(false);

    // What the mobile app is served for this learner: the same row.
    const me = (await getMe(pool, WEB))!;
    expect(me.entitlements).toMatchObject([
      { plan: 'pro_monthly', status: 'active', provider: 'stripe', cancelAtPeriodEnd: false },
    ]);
    const dashboard = (await getDashboard(pool, WEB))!;
    expect(dashboard.countries[0]).toMatchObject({ publishedQuestions: 25, fullAccess: true });
    expect(dashboard.countries[0]!.exams[0]).toMatchObject({
      locked: false,
      unavailableReason: null,
    });
    expect((await getCountryPack(pool, WEB, COUNTRY)).questions).toHaveLength(25);
    const exam = await startMockExam(pool, WEB, { countryCode: COUNTRY, examFormatId: formatId });
    expect((await loadStudySession(pool, WEB, exam))!.questions).toHaveLength(22);

    // Stripe delivers events more than once.
    expect(await applyStripeEvent(pool, created, prices)).toEqual({
      kind: 'ignored',
      reason: 'already handled',
    });
  });

  it('keeps Pro to the end of the paid period after cancelling, then removes it', async () => {
    const periodEnd = now + 29 * DAY;
    const cancelled = stripeEvent(
      'customer.subscription.updated',
      // No user id on this one: the learner is found by their Stripe customer.
      subscription({ cancel_at_period_end: true, metadata: {} }),
    );
    expect(await applyStripeEvent(pool, cancelled, prices)).toEqual({
      kind: 'applied',
      userId: WEB,
    });
    expect((await getMe(pool, WEB))!.entitlements[0]).toMatchObject({
      status: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date(unix(periodEnd) * 1000).toISOString(),
    });
    // Still Pro today, and on the last day.
    expect(await pro(WEB)).toBe(true);
    expect(await pro(WEB, new Date(periodEnd - 60_000))).toBe(true);

    // An older event turning up late changes nothing.
    const stale = stripeEvent('customer.subscription.updated', subscription(), now - DAY);
    await applyStripeEvent(pool, stale, prices);
    expect((await getMe(pool, WEB))!.entitlements[0]!.cancelAtPeriodEnd).toBe(true);

    // The period ends: Stripe deletes the subscription.
    const ended = stripeEvent(
      'customer.subscription.deleted',
      subscription({ status: 'canceled', cancel_at_period_end: true, ended_at: unix(periodEnd) }),
      periodEnd,
    );
    expect(await applyStripeEvent(pool, ended, prices)).toEqual({ kind: 'applied', userId: WEB });
    expect(await pro(WEB, new Date(periodEnd + 1000))).toBe(false);
    const after = (await getDashboard(pool, WEB, new Date(periodEnd + 1000)))!;
    expect(after.countries[0]).toMatchObject({ publishedQuestions: 20, fullAccess: false });
  });

  it('sells a Country Pass once, for one country, and takes it back on a refund', async () => {
    const paid = stripeEvent('checkout.session.completed', {
      id: 'cs_test_billing_2',
      mode: 'payment',
      client_reference_id: WEB,
      customer: 'cus_testbillingweb',
      payment_status: 'paid',
      payment_intent: 'pi_test_billing_1',
      metadata: { user_id: WEB, plan: 'country_pass', country_code: COUNTRY.toLowerCase() },
    });
    expect(await applyStripeEvent(pool, paid, prices)).toEqual({ kind: 'applied', userId: WEB });
    const user = await accessUser(pool, WEB);
    const later = new Date(now + 3650 * DAY);
    expect(hasAccess(user, 'all_questions', COUNTRY, later)).toBe(true);
    expect(hasAccess(user, 'all_questions', 'US', later)).toBe(false);
    expect(hasAccess(user, 'more_ai', null, later)).toBe(false);

    const unpaid = stripeEvent('checkout.session.completed', {
      id: 'cs_test_billing_3',
      mode: 'payment',
      client_reference_id: PHONE,
      payment_status: 'unpaid',
      metadata: { plan: 'country_pass', country_code: COUNTRY },
    });
    expect(await applyStripeEvent(pool, unpaid, prices)).toMatchObject({ reason: 'not paid yet' });
    const nowhere = stripeEvent('checkout.session.completed', {
      id: 'cs_test_billing_4',
      mode: 'payment',
      client_reference_id: PHONE,
      payment_status: 'paid',
      metadata: { plan: 'country_pass', country_code: 'QQ' },
    });
    expect(await applyStripeEvent(pool, nowhere, prices)).toMatchObject({
      reason: 'no such country',
    });
    expect(await pro(PHONE)).toBe(false);

    const partial = stripeEvent('charge.refunded', {
      payment_intent: 'pi_test_billing_1',
      refunded: false,
    });
    expect(await applyStripeEvent(pool, partial, prices)).toMatchObject({ kind: 'ignored' });
    const refund = stripeEvent('charge.refunded', {
      payment_intent: 'pi_test_billing_1',
      refunded: true,
    });
    expect(await applyStripeEvent(pool, refund, prices)).toEqual({ kind: 'applied', userId: WEB });
    expect(hasAccess(await accessUser(pool, WEB), 'all_questions', COUNTRY, later)).toBe(false);
  });

  it('ignores Stripe events that are not about a learner’s plan', async () => {
    const stranger = stripeEvent(
      'customer.subscription.created',
      subscription({ id: 'sub_test_billing_x', customer: 'cus_unknown', metadata: {} }),
    );
    expect(await applyStripeEvent(pool, stranger, prices)).toMatchObject({
      reason: 'no such learner',
    });
    const ghost = stripeEvent('checkout.session.completed', {
      id: 'cs_x',
      mode: 'payment',
      client_reference_id: 'test:nobody',
    });
    expect(await applyStripeEvent(pool, ghost, prices)).toMatchObject({
      reason: 'no such learner',
    });
    const other = stripeEvent('invoice.paid', { id: 'in_1' });
    expect(await applyStripeEvent(pool, other, prices)).toMatchObject({ kind: 'ignored' });
    const unpayable = stripeEvent(
      'customer.subscription.created',
      subscription({ id: 'sub_test_billing_y', status: 'incomplete' }),
    );
    expect(await applyStripeEvent(pool, unpayable, prices)).toMatchObject({
      reason: 'not a plan to record',
    });
  });

  it('turns an App Store purchase into Pro, on the web too', async () => {
    expect(await pro(PHONE)).toBe(false);
    const bought = storeEvent({});
    expect(await applyRevenueCatEvent(pool, bought)).toEqual({ kind: 'applied', userId: PHONE });
    // What the web app is served for this learner.
    expect((await getMe(pool, PHONE))!.entitlements).toMatchObject([
      { plan: 'pro_yearly', status: 'active', provider: 'app_store' },
    ]);
    expect((await getDashboard(pool, PHONE))!.countries[0]).toMatchObject({ fullAccess: true });
    expect(await applyRevenueCatEvent(pool, bought)).toMatchObject({ reason: 'already handled' });
  });

  it('keeps a store subscription to its expiry after cancelling, then removes it', async () => {
    const expiry = now + 364 * DAY;
    await applyRevenueCatEvent(
      pool,
      storeEvent({ type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' }),
    );
    expect((await getMe(pool, PHONE))!.entitlements[0]).toMatchObject({
      status: 'active',
      cancelAtPeriodEnd: true,
    });
    expect(await pro(PHONE)).toBe(true);
    expect(await pro(PHONE, new Date(expiry - 60_000))).toBe(true);

    await applyRevenueCatEvent(
      pool,
      storeEvent({ type: 'EXPIRATION', event_timestamp_ms: expiry }),
    );
    expect((await getMe(pool, PHONE))!.entitlements[0]!.status).toBe('expired');
    expect(await pro(PHONE, new Date(expiry + 1000))).toBe(false);
  });

  it('records a store Country Pass, and moves purchases when the store account moves', async () => {
    const pass = storeEvent({
      type: 'NON_RENEWING_PURCHASE',
      product_id: `oathly_country_pass_${COUNTRY.toLowerCase()}`,
      store: 'PLAY_STORE',
      expiration_at_ms: null,
      original_transaction_id: 'tx_test_billing_2',
      // Bought before signing in, under RevenueCat's own id; the alias is the learner.
      app_user_id: '$RCAnonymousID:abc',
      aliases: ['$RCAnonymousID:abc', PHONE],
    });
    expect(await applyRevenueCatEvent(pool, pass)).toEqual({ kind: 'applied', userId: PHONE });
    expect(await pro(PHONE, new Date(now + 3650 * DAY))).toBe(true);

    const elsewhere = storeEvent({
      product_id: 'oathly_country_pass_qq',
      original_transaction_id: 'tx_test_billing_3',
    });
    expect(await applyRevenueCatEvent(pool, elsewhere)).toMatchObject({
      reason: 'no such country',
    });
    const stranger = storeEvent({
      app_user_id: 'test:nobody',
      original_transaction_id: 'tx_test_billing_4',
    });
    expect(await applyRevenueCatEvent(pool, stranger)).toMatchObject({ reason: 'no such learner' });
    expect(await applyRevenueCatEvent(pool, storeEvent({ type: 'TEST' }))).toMatchObject({
      kind: 'ignored',
    });

    // The same store account is now used with the other Oathly account.
    const transfer = storeEvent({
      type: 'TRANSFER',
      transferred_from: [PHONE],
      transferred_to: ['test:nobody', WEB],
    });
    expect(await applyRevenueCatEvent(pool, transfer)).toEqual({ kind: 'applied', userId: WEB });
    const later = new Date(now + 3650 * DAY);
    expect(await pro(PHONE, later)).toBe(false);
    expect(await pro(WEB, later)).toBe(true);
    expect(await applyRevenueCatEvent(pool, transfer)).toMatchObject({ reason: 'already handled' });
    const nowhere = storeEvent({
      type: 'TRANSFER',
      transferred_from: [WEB],
      transferred_to: ['test:nobody'],
    });
    expect(await applyRevenueCatEvent(pool, nowhere)).toMatchObject({ kind: 'ignored' });
  });
});
