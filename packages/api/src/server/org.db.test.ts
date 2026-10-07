import { hasAccess } from '@oathly/core';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  accessUser,
  applyStripeEvent,
  orgStripeCustomerFor,
  stripeCustomerFor,
  type StripeEvent,
} from './billing';
import { getMe } from './me';
import {
  acceptInvite,
  assignLearner,
  createOrganization,
  findInvite,
  getOrgAccess,
  getOrgLogo,
  getOrgReport,
  getSeats,
  inviteLearners,
  leaveOrganization,
  listInvites,
  listStaff,
  OrgError,
  pendingInvitesFor,
  removeLogo,
  removeMember,
  renewInvite,
  revokeInvite,
  saveLogo,
  updateOrganization,
} from './org';
import { getDashboard } from './study';

// Organizations end to end against a real database: invite, join, follow,
// and the walls between one organization and another, and between one
// learner and the next. Needs the local database (`pnpm db:start`); skipped
// when the URL is not set. The country and the ids here are used by no other test.
const url = process.env.TEST_DATABASE_URL;
const COUNTRY = 'ZR';
const OWNER = 'test:org-owner';
const ADMIN = 'test:org-admin';
const MARIA = 'test:org-maria';
const MINH = 'test:org-minh';
const LENA = 'test:org-lena';
const RIVAL = 'test:org-rival';
const OUTSIDER = 'test:org-outsider';
const REVIEWER = 'test:org-reviewer';
const everyone = [OWNER, ADMIN, MARIA, MINH, LENA, RIVAL, OUTSIDER];
const prices = {
  pro_monthly: 'price_month',
  pro_yearly: 'price_year',
  country_pass: 'price_pass',
  team: 'price_seat',
};

const DAY = 86_400_000;
const now = new Date();
const unix = (ms: number) => Math.floor(ms / 1000);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

const problem = async (work: Promise<unknown>) => {
  try {
    await work;
  } catch (error) {
    if (error instanceof OrgError) return error.problem;
    throw error;
  }
  return null;
};

describe.skipIf(!url)('organizations against the database', () => {
  let pool: pg.Pool;
  let orgId: string;
  let rivalOrgId: string;
  let questionIds: string[];
  let sequence = 0;

  const seatEvent = (seats: number, overrides: Record<string, unknown> = {}): StripeEvent => ({
    id: `evt_test_org_${++sequence}`,
    type: 'customer.subscription.updated',
    created: unix(now.getTime() + sequence * 1000),
    data: {
      object: {
        id: 'sub_test_org_1',
        status: 'active',
        customer: 'cus_testorgriverside',
        metadata: { organization_id: orgId, plan: 'team', user_id: OWNER },
        cancel_at_period_end: false,
        current_period_start: unix(now.getTime() - DAY),
        current_period_end: unix(now.getTime() + 29 * DAY),
        items: { data: [{ price: { id: 'price_seat' }, quantity: seats }] },
        ...overrides,
      },
    },
  });

  async function cleanUp() {
    await pool.query(
      `delete from public.organizations
       where created_by = any($1) or slug like 'test-org-riverside%' or slug like 'test-org-harbor%'`,
      [everyone],
    );
    await pool.query('delete from public.profiles where id = any($1)', [everyone]);
    await pool.query('delete from public.questions where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.profiles where id = $1', [REVIEWER]);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
    await pool.query(`delete from public.billing_events where event_id like 'evt_test_org_%'`);
  }

  /** Answers the first `count` questions, `correct` of them rightly. */
  async function study(userId: string, count: number, correct: number, at: Date) {
    const attempt = (
      await pool.query<{ id: string }>(
        `insert into public.attempts (user_id, country_code, question_count, correct_count, started_at)
         values ($1, $2, $3, $4, $5) returning id`,
        [userId, COUNTRY, count, correct, at],
      )
    ).rows[0]!.id;
    for (let index = 0; index < count; index += 1) {
      await pool.query(
        `insert into public.answer_events
           (user_id, attempt_id, question_id, question_version, correct, time_ms, created_at)
         values ($1, $2, $3, 1, $4, 30000, $5)`,
        [userId, attempt, questionIds[index], index < correct, at],
      );
    }
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    for (const id of [...everyone, REVIEWER]) {
      await pool.query('insert into public.profiles (id, display_name) values ($1, $2)', [
        id,
        id.replace('test:org-', ''),
      ]);
    }
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages)
       values ($1, 'Orgland', true, '{en}')`,
      [COUNTRY],
    );
    await pool.query(
      `insert into public.exam_formats (country_code, slug, name, format_type, question_count, pass_mark, source_url)
       values ($1, 'written', 'Orgland test', 'written', 10, 7, 'https://example.test')`,
      [COUNTRY],
    );
    const topic = (
      await pool.query<{ id: string }>(
        `insert into public.topics (country_code, slug, name) values ($1, 'civics', 'Civics') returning id`,
        [COUNTRY],
      )
    ).rows[0]!.id;
    questionIds = [];
    for (let i = 1; i <= 25; i += 1) {
      const id = (
        await pool.query<{ id: string }>(
          `insert into public.questions (country_code, topic_id, difficulty, type, correct_answer, source_url, status, verified_by, last_verified_at)
           values ($1, $2, 2, 'multiple_choice', '{"keys": ["a"]}', 'https://example.test', 'published', $3, now()) returning id`,
          [COUNTRY, topic, REVIEWER],
        )
      ).rows[0]!.id;
      questionIds.push(id);
      await pool.query(
        `insert into public.question_translations (question_id, locale, text, options, status, reviewed_by, reviewed_at)
         values ($1, 'en', $2, '[{"key":"a","text":"Orgland yes"},{"key":"b","text":"Orgland no"}]', 'approved', $3, now())`,
        [id, `Orgland question ${i}`, REVIEWER],
      );
    }
    // Minh already uses Oathly; Maria and Lena have yet to set it up.
    await pool.query(
      `insert into public.user_settings (user_id, onboarded_at) values ($1, now())`,
      [MINH],
    );

    orgId = (
      await createOrganization(pool, OWNER, {
        name: 'Test Org Riverside',
        kind: 'law_firm',
        email: 'Owner@Example.test',
      })
    ).id;
    rivalOrgId = (
      await createOrganization(pool, RIVAL, { name: 'Test Org Harbor', kind: 'school' })
    ).id;
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('makes whoever creates an organization its owner, at an address of its own', async () => {
    const access = (await getOrgAccess(pool, OWNER, { slug: 'test-org-riverside' }))!;
    expect(access).toMatchObject({
      role: 'owner',
      granted: 0,
      organization: { id: orgId, name: 'Test Org Riverside', kind: 'law_firm' },
    });
    // The same name again gets the next address rather than an error.
    const twin = await createOrganization(pool, OWNER, {
      name: 'Test Org Riverside',
      kind: 'other',
    });
    expect(twin.slug).toBe('test-org-riverside-2');
    await pool.query('delete from public.organizations where id = $1', [twin.id]);

    expect(await problem(createOrganization(pool, OWNER, { name: '  ', kind: 'school' }))).toBe(
      'invalid',
    );
    expect(await problem(createOrganization(pool, OWNER, { name: 'A bank', kind: 'bank' }))).toBe(
      'invalid',
    );
    expect(await getOrgAccess(pool, OUTSIDER, { slug: 'test-org-riverside' })).toBeNull();
    expect(await getOrgAccess(pool, OWNER, { id: 'not-an-id' })).toBeNull();
  });

  it('invites nobody to learn until the organization has seats', async () => {
    const outcome = await inviteLearners(pool, OWNER, orgId, [
      { email: 'maria@example.test', name: 'Maria Silva', countryCode: COUNTRY, targetDate: null },
    ]);
    expect(outcome).toEqual({ invited: [], alreadyMembers: [], noSeats: ['maria@example.test'] });
    // Someone to help run it takes no seat.
    const staff = await inviteLearners(
      pool,
      OWNER,
      orgId,
      [{ email: 'Admin@Example.test', name: null, countryCode: COUNTRY, targetDate: null }],
      { role: 'admin' },
    );
    expect(staff.invited).toHaveLength(1);
    const joined = await acceptInvite(
      pool,
      { userId: ADMIN, email: null },
      {
        token: staff.invited[0]!.token,
      },
    );
    expect(joined).toMatchObject({ role: 'admin', countryCode: null, onStudyPlan: true });
    expect(await listStaff(pool, OWNER, orgId)).toMatchObject([
      { userId: OWNER, role: 'owner', email: 'owner@example.test' },
      { userId: ADMIN, role: 'admin', email: 'admin@example.test' },
    ]);
  });

  it('gets its seats from Stripe: a subscription for the organization, not a person', async () => {
    // Checkout finishing links the Stripe customer to the organization, never to the admin who paid.
    const checkout: StripeEvent = {
      id: `evt_test_org_${++sequence}`,
      type: 'checkout.session.completed',
      created: unix(now.getTime()),
      data: {
        object: {
          id: 'cs_test_org_1',
          mode: 'subscription',
          client_reference_id: OWNER,
          customer: 'cus_testorgriverside',
          metadata: { organization_id: orgId, plan: 'team', user_id: OWNER },
        },
      },
    };
    expect(await applyStripeEvent(pool, checkout, prices)).toMatchObject({ kind: 'ignored' });
    expect(await orgStripeCustomerFor(pool, orgId)).toBe('cus_testorgriverside');
    expect(await stripeCustomerFor(pool, OWNER)).toBeNull();

    expect(await applyStripeEvent(pool, seatEvent(3), prices)).toEqual({
      kind: 'applied',
      userId: OWNER,
      organizationId: orgId,
    });
    expect(await getSeats(pool, orgId, 0)).toMatchObject({
      total: 3,
      used: 0,
      pending: 0,
      available: 3,
      over: 0,
      subscription: { seats: 3, status: 'active', inForce: true },
    });
    // Buying seats does not make the admin who paid a Pro learner.
    expect(hasAccess(await accessUser(pool, OWNER), 'all_questions', COUNTRY)).toBe(false);
    // A seat event for an organization that does not exist changes nothing.
    const stray = seatEvent(9, {
      id: 'sub_test_org_stray',
      customer: 'cus_testorgstray',
      metadata: { organization_id: '00000000-0000-4000-8000-000000000000', plan: 'team' },
    });
    expect(await applyStripeEvent(pool, stray, prices)).toMatchObject({ kind: 'ignored' });
  });

  it('invites learners from a list, holding a seat for each', async () => {
    const outcome = await inviteLearners(pool, ADMIN, orgId, [
      {
        email: 'maria@example.test',
        name: 'Maria Silva',
        countryCode: COUNTRY,
        targetDate: '2030-03-01',
      },
      { email: 'minh@example.test', name: null, countryCode: COUNTRY, targetDate: null },
      { email: 'lena@example.test', name: 'Lena Roth', countryCode: null, targetDate: null },
      { email: 'fourth@example.test', name: null, countryCode: null, targetDate: null },
    ]);
    expect(outcome.invited.map((invite) => invite.email)).toEqual([
      'maria@example.test',
      'minh@example.test',
      'lena@example.test',
    ]);
    expect(outcome.noSeats).toEqual(['fourth@example.test']);
    expect(await getSeats(pool, orgId, 0)).toMatchObject({ used: 0, pending: 3, available: 0 });

    const invites = await listInvites(pool, ADMIN, orgId);
    expect(invites.map((invite) => invite.email).sort()).toEqual([
      'lena@example.test',
      'maria@example.test',
      'minh@example.test',
    ]);
    expect(invites.every((invite) => !invite.expired && invite.role === 'member')).toBe(true);
    // The link's token is not in the database, only its hash.
    const stored = await pool.query<{ token_hash: string }>(
      'select token_hash from public.org_invites where organization_id = $1',
      [orgId],
    );
    for (const invite of outcome.invited) {
      expect(stored.rows.map((row) => row.token_hash)).not.toContain(invite.token);
    }

    // What the invited person sees before deciding.
    const view = (await findInvite(pool, outcome.invited[0]!.token))!;
    expect(view).toMatchObject({
      email: 'maria@example.test',
      countryCode: COUNTRY,
      countryName: 'Orgland',
      targetDate: '2030-03-01',
      organization: { name: 'Test Org Riverside' },
    });
    expect(await findInvite(pool, 'x'.repeat(43))).toBeNull();
    expect(await findInvite(pool, 'not a token')).toBeNull();

    // Maria has not set Oathly up: she joins, and is sent to do that with her country in hand.
    expect(
      await acceptInvite(
        pool,
        { userId: MARIA, email: null },
        { token: outcome.invited[0]!.token },
      ),
    ).toMatchObject({
      role: 'member',
      countryCode: COUNTRY,
      targetDate: '2030-03-01',
      onStudyPlan: false,
    });
    // A link works once.
    expect(
      await problem(
        acceptInvite(pool, { userId: OUTSIDER, email: null }, { token: outcome.invited[0]!.token }),
      ),
    ).toBe('invite-gone');

    // Minh signs in with the address he was invited at and accepts from his dashboard.
    const waiting = await pendingInvitesFor(pool, ' Minh@Example.test ');
    expect(waiting).toHaveLength(1);
    expect(
      await problem(
        acceptInvite(
          pool,
          { userId: OUTSIDER, email: 'other@example.test' },
          {
            inviteId: waiting[0]!.id,
          },
        ),
      ),
    ).toBe('wrong-address');
    expect(
      await problem(
        acceptInvite(pool, { userId: OUTSIDER, email: null }, { inviteId: waiting[0]!.id }),
      ),
    ).toBe('wrong-address');
    expect(
      await acceptInvite(
        pool,
        { userId: MINH, email: 'minh@example.test' },
        {
          inviteId: waiting[0]!.id,
        },
      ),
    ).toMatchObject({ role: 'member', countryCode: COUNTRY, onStudyPlan: true });
    // The country is on his study plan, as the one the app opens on.
    expect((await getMe(pool, MINH))!.studyCountries).toMatchObject([
      { countryCode: COUNTRY, isPrimary: true },
    ]);
    expect(await pendingInvitesFor(pool, 'minh@example.test')).toEqual([]);
    expect(await pendingInvitesFor(pool, null)).toEqual([]);
    expect(
      await problem(acceptInvite(pool, { userId: MINH, email: null }, { inviteId: 'nope' })),
    ).toBe('invite-gone');

    expect(await getSeats(pool, orgId, 0)).toMatchObject({ used: 2, pending: 1, available: 0 });
    // Inviting a member again says so; inviting a pending address again replaces its link.
    const again = await inviteLearners(pool, ADMIN, orgId, [
      { email: 'maria@example.test', name: null, countryCode: null, targetDate: null },
      { email: 'lena@example.test', name: 'Lena Roth', countryCode: COUNTRY, targetDate: null },
    ]);
    expect(again.alreadyMembers).toEqual(['maria@example.test']);
    expect(again.invited.map((invite) => invite.email)).toEqual(['lena@example.test']);
    expect(await findInvite(pool, outcome.invited[2]!.token)).toBeNull();
    expect((await findInvite(pool, again.invited[0]!.token))!.countryCode).toBe(COUNTRY);
  });

  it('gives a learner with a seat everything Pro has, and says who it is from', async () => {
    await pool.query(
      `insert into public.user_settings (user_id, onboarded_at) values ($1, now())`,
      [MARIA],
    );
    await pool.query(
      `insert into public.user_countries (user_id, country_code, is_primary) values ($1, $2, true)`,
      [MARIA, COUNTRY],
    );
    const maria = await accessUser(pool, MARIA);
    expect(maria.entitlements).toMatchObject([
      {
        plan: 'team',
        status: 'active',
        provider: 'manual',
        organizationName: 'Test Org Riverside',
      },
    ]);
    expect(hasAccess(maria, 'all_questions', COUNTRY)).toBe(true);
    expect(hasAccess(maria, 'more_ai', null)).toBe(true);
    expect((await getDashboard(pool, MARIA))!.countries[0]).toMatchObject({
      publishedQuestions: 25,
      fullAccess: true,
    });
    const me = (await getMe(pool, MARIA))!;
    expect(me.organizations).toMatchObject([
      { organizationId: orgId, role: 'member', countryCode: COUNTRY, targetDate: '2030-03-01' },
    ]);
    // Someone outside the organization is on the Free plan as before.
    expect(hasAccess(await accessUser(pool, OUTSIDER), 'all_questions', COUNTRY)).toBe(false);
  });

  it('shows an admin each learner’s readiness and activity', async () => {
    await study(MARIA, 20, 18, new Date(now.getTime() - 2 * 3_600_000));
    await study(MINH, 6, 2, new Date(now.getTime() - 20 * DAY));

    const report = await getOrgReport(pool, ADMIN, orgId, now);
    expect(report.organization.id).toBe(orgId);
    expect(report.learners.map((learner) => learner.userId)).toEqual([MARIA, MINH]);
    const [maria, minh] = report.learners as [
      (typeof report.learners)[0],
      (typeof report.learners)[0],
    ];
    expect(maria).toMatchObject({
      name: 'Maria Silva',
      email: 'maria@example.test',
      countryCode: COUNTRY,
      countryName: 'Orgland',
      targetDate: '2030-03-01',
      hasSeat: true,
      questionsSeen: 20,
      answers: 20,
      answersThisWeek: 20,
      minutesThisWeek: 10,
      activity: 'active',
      standing: 'on_track',
    });
    expect(maria.readiness).toBeGreaterThan(0);
    expect(maria.daysLeft).toBeGreaterThan(1000);
    // The same number Maria sees on her own dashboard.
    expect(maria.readiness).toBe(
      (await getDashboard(pool, MARIA, now))!.countries[0]!.readiness!.score,
    );
    expect(minh).toMatchObject({
      name: 'minh',
      email: 'minh@example.test',
      answers: 6,
      answersThisWeek: 0,
      activity: 'quiet',
      targetDate: null,
      daysLeft: null,
    });
    expect(minh.readiness).toBeLessThan(maria.readiness!);
    expect(report.summary).toMatchObject({ learners: 2, started: 2, activeThisWeek: 1 });

    // The owner sees the same; the report never includes the people who run the organization.
    const owners = await getOrgReport(pool, OWNER, orgId, now);
    expect(owners.learners.map((learner) => learner.userId)).toEqual([MARIA, MINH]);
  });

  it('shows learners nothing of each other, and outsiders nothing at all', async () => {
    // A learner cannot open the report, the invitations or the staff list.
    expect(await problem(getOrgReport(pool, MARIA, orgId))).toBe('forbidden');
    expect(await problem(listInvites(pool, MARIA, orgId))).toBe('forbidden');
    expect(await problem(listStaff(pool, MARIA, orgId))).toBe('forbidden');
    expect(
      await problem(
        inviteLearners(pool, MARIA, orgId, [
          { email: 'friend@example.test', name: null, countryCode: null, targetDate: null },
        ]),
      ),
    ).toBe('forbidden');
    expect(
      await problem(
        assignLearner(pool, MARIA, orgId, MINH, { countryCode: null, targetDate: null }),
      ),
    ).toBe('forbidden');
    expect(await problem(removeMember(pool, MARIA, orgId, MINH))).toBe('forbidden');
    // What a learner is told about their organization names no other member.
    const me = (await getMe(pool, MARIA))!;
    expect(JSON.stringify(me)).not.toContain('minh');
    expect(JSON.stringify(await getDashboard(pool, MARIA))).not.toContain('minh');

    // Another organization's owner, and someone in none, are told it does not exist.
    for (const stranger of [RIVAL, OUTSIDER]) {
      expect(await problem(getOrgReport(pool, stranger, orgId))).toBe('not-found');
      expect(await problem(listInvites(pool, stranger, orgId))).toBe('not-found');
      expect(await problem(removeMember(pool, stranger, orgId, MARIA))).toBe('not-found');
      expect(
        await problem(
          updateOrganization(pool, stranger, orgId, {
            name: 'Taken over',
            kind: 'other',
            brandColor: null,
            brandAccent: null,
          }),
        ),
      ).toBe('not-found');
    }
    // And the rival's own report is empty: nobody else's learners leak into it.
    expect((await getOrgReport(pool, RIVAL, rivalOrgId)).learners).toEqual([]);
  });

  it('lets an admin change what a learner is preparing for', async () => {
    await assignLearner(pool, ADMIN, orgId, MINH, {
      countryCode: COUNTRY,
      targetDate: '2031-01-15',
    });
    expect((await getMe(pool, MINH))!.studyCountries).toMatchObject([
      { countryCode: COUNTRY, examDate: '2031-01-15', isPrimary: true },
    ]);
    const report = await getOrgReport(pool, ADMIN, orgId, now);
    expect(report.learners[1]).toMatchObject({ userId: MINH, targetDate: '2031-01-15' });

    expect(
      await problem(
        assignLearner(pool, ADMIN, orgId, MINH, { countryCode: 'QQ', targetDate: null }),
      ),
    ).toBe('invalid');
    expect(
      await problem(
        assignLearner(pool, ADMIN, orgId, MINH, { countryCode: COUNTRY, targetDate: '2031-02-31' }),
      ),
    ).toBe('invalid');
    // Only learners are assigned exams, and only people in the organization.
    expect(
      await problem(
        assignLearner(pool, OWNER, orgId, ADMIN, { countryCode: null, targetDate: null }),
      ),
    ).toBe('forbidden');
    expect(
      await problem(
        assignLearner(pool, OWNER, orgId, OUTSIDER, { countryCode: null, targetDate: null }),
      ),
    ).toBe('not-found');
  });

  it('keeps the earliest learners on Pro when seats run short, and cuts them off when seats end', async () => {
    // Down to one seat: Maria joined first and keeps hers.
    await applyStripeEvent(pool, seatEvent(1), prices);
    expect(await getSeats(pool, orgId, 0)).toMatchObject({ total: 1, used: 2, over: 1 });
    expect(hasAccess(await accessUser(pool, MARIA), 'all_questions', COUNTRY)).toBe(true);
    expect(hasAccess(await accessUser(pool, MINH), 'all_questions', COUNTRY)).toBe(false);
    const short = await getOrgReport(pool, ADMIN, orgId, now);
    expect(short.learners.map((learner) => learner.hasSeat)).toEqual([true, false]);

    // Cancelled, paid up to the end of the month: seats stay until then.
    await applyStripeEvent(pool, seatEvent(3, { cancel_at_period_end: true }), prices);
    const later = new Date(now.getTime() + 40 * DAY);
    expect(hasAccess(await accessUser(pool, MINH), 'all_questions', COUNTRY, now)).toBe(true);
    expect(hasAccess(await accessUser(pool, MINH), 'all_questions', COUNTRY, later)).toBe(false);
    expect(await getSeats(pool, orgId, 0, later)).toMatchObject({ total: 0, over: 2 });

    // Seats granted by staff need no subscription.
    await pool.query('update public.organizations set seat_limit = 2 where id = $1', [orgId]);
    expect(hasAccess(await accessUser(pool, MINH), 'all_questions', COUNTRY, later)).toBe(true);
    const access = (await getOrgAccess(pool, OWNER, { id: orgId }))!;
    expect(await getSeats(pool, orgId, access.granted, later)).toMatchObject({
      total: 2,
      granted: 2,
      over: 0,
    });
    await pool.query('update public.organizations set seat_limit = null where id = $1', [orgId]);
    await applyStripeEvent(pool, seatEvent(3), prices);
  });

  it('expires, renews and revokes invitations', async () => {
    const [lena] = await listInvites(pool, OWNER, orgId);
    const afterExpiry = new Date(now.getTime() + 31 * DAY);
    expect((await listInvites(pool, OWNER, orgId, afterExpiry))[0]!.expired).toBe(true);
    // An expired invitation holds no seat and opens nothing.
    expect(await getSeats(pool, orgId, 0, afterExpiry)).toMatchObject({ pending: 0 });
    expect(await pendingInvitesFor(pool, 'lena@example.test', afterExpiry)).toEqual([]);
    expect(
      await problem(
        acceptInvite(
          pool,
          { userId: LENA, email: 'lena@example.test' },
          { inviteId: lena!.id },
          afterExpiry,
        ),
      ),
    ).toBe('invite-gone');

    const renewed = await renewInvite(pool, OWNER, orgId, lena!.id);
    expect(renewed.invited).toMatchObject([{ email: 'lena@example.test', name: 'Lena Roth' }]);
    expect(await problem(renewInvite(pool, OWNER, orgId, 'nope'))).toBe('invite-gone');
    expect(await problem(renewInvite(pool, RIVAL, orgId, lena!.id))).toBe('not-found');

    // Another organization cannot revoke it; its own admin can.
    await revokeInvite(pool, RIVAL, rivalOrgId, lena!.id);
    expect(await findInvite(pool, renewed.invited[0]!.token)).not.toBeNull();
    await revokeInvite(pool, ADMIN, orgId, 'nope');
    await revokeInvite(pool, ADMIN, orgId, lena!.id);
    expect(await findInvite(pool, renewed.invited[0]!.token)).toBeNull();
    expect(await listInvites(pool, ADMIN, orgId)).toEqual([]);
  });

  it('keeps the organization’s look, and its logo only if it is an image', async () => {
    await updateOrganization(pool, ADMIN, orgId, {
      name: ' Test Org  Riverside ',
      kind: 'nonprofit',
      brandColor: '#0B5FFF',
      brandAccent: '',
    });
    const version = await saveLogo(pool, ADMIN, orgId, png);
    expect(version).toMatch(/^[0-9a-f]{16}$/);
    expect((await getOrgAccess(pool, OWNER, { id: orgId }))!.organization).toMatchObject({
      name: 'Test Org Riverside',
      kind: 'nonprofit',
      brand: { color: '#0b5fff', accent: null, logoVersion: version },
    });
    // The learner's apps are told the look; so is anyone holding an invitation link.
    expect((await getMe(pool, MARIA))!.organizations[0]!.brand).toEqual({
      color: '#0b5fff',
      accent: null,
      logoVersion: version,
    });
    expect(await getOrgLogo(pool, orgId)).toMatchObject({ contentType: 'image/png', version });
    expect(Buffer.compare((await getOrgLogo(pool, orgId))!.data, Buffer.from(png))).toBe(0);
    expect(await getOrgLogo(pool, 'nope')).toBeNull();
    expect(await getOrgLogo(pool, rivalOrgId)).toBeNull();

    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(await problem(saveLogo(pool, ADMIN, orgId, svg))).toBe('bad-logo');
    const huge = new Uint8Array(300 * 1024);
    huge.set(png);
    expect(await problem(saveLogo(pool, ADMIN, orgId, huge))).toBe('bad-logo');
    expect(await problem(saveLogo(pool, MARIA, orgId, png))).toBe('forbidden');
    for (const bad of [
      { name: '', brandColor: null },
      { name: 'x', brandColor: 'blue' },
      { name: 'x', brandColor: null, brandAccent: '#12345' },
      { name: 'x', brandColor: null, kind: 'bank' },
    ]) {
      expect(
        await problem(
          updateOrganization(pool, OWNER, orgId, {
            kind: 'school',
            brandAccent: null,
            ...bad,
          }),
        ),
      ).toBe('invalid');
    }
    await removeLogo(pool, OWNER, orgId);
    expect(await getOrgLogo(pool, orgId)).toBeNull();
  });

  it('lets a learner leave, and an admin remove one, without touching their own history', async () => {
    // An admin cannot remove the owner or a fellow admin; the owner cannot be removed at all.
    expect(await problem(removeMember(pool, ADMIN, orgId, OWNER))).toBe('forbidden');
    expect(await problem(removeMember(pool, OWNER, orgId, OWNER))).toBe('forbidden');
    await leaveOrganization(pool, OWNER, orgId);
    expect((await getOrgAccess(pool, OWNER, { id: orgId }))!.role).toBe('owner');

    await leaveOrganization(pool, MINH, orgId);
    await leaveOrganization(pool, MINH, 'nope');
    expect(await getOrgAccess(pool, MINH, { id: orgId })).toBeNull();
    expect((await getOrgReport(pool, ADMIN, orgId)).learners.map((l) => l.userId)).toEqual([MARIA]);
    // He is off the seat, and still has every answer he gave.
    expect(hasAccess(await accessUser(pool, MINH), 'all_questions', COUNTRY)).toBe(false);
    expect((await getMe(pool, MINH))!.progress.questionsAnswered).toBe(6);
    expect((await getMe(pool, MINH))!.organizations).toEqual([]);

    await removeMember(pool, ADMIN, orgId, MARIA);
    await removeMember(pool, ADMIN, orgId, MARIA);
    expect((await getOrgReport(pool, OWNER, orgId)).learners).toEqual([]);
    expect((await getMe(pool, MARIA))!.progress.questionsAnswered).toBe(20);
    await removeMember(pool, OWNER, orgId, ADMIN);
    expect(await listStaff(pool, OWNER, orgId)).toHaveLength(1);
  });
});
