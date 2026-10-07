import { describe, expect, it } from 'vitest';

import {
  activityLevel,
  canManageMember,
  csvCell,
  INVITE_LIST_LIMIT,
  isIsoDate,
  isOrgAdmin,
  isOrgKind,
  learnerActivity,
  learnerStanding,
  logoType,
  normalizeEmail,
  orgSlug,
  parseCsv,
  parseInviteList,
  READY_SCORE,
  seatSource,
  seatsInForce,
  seatUsage,
  summarizeLearners,
  toCsv,
} from './org';

const now = new Date('2026-10-07T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

describe('roles', () => {
  it('counts owners and admins as running the organization', () => {
    expect(isOrgAdmin('owner')).toBe(true);
    expect(isOrgAdmin('admin')).toBe(true);
    expect(isOrgAdmin('member')).toBe(false);
    expect(isOrgAdmin(null)).toBe(false);
    expect(isOrgAdmin(undefined)).toBe(false);
  });

  it('lets the owner manage everyone else, and an admin manage learners', () => {
    expect(canManageMember('owner', 'admin')).toBe(true);
    expect(canManageMember('owner', 'member')).toBe(true);
    expect(canManageMember('admin', 'member')).toBe(true);
    expect(canManageMember('admin', 'admin')).toBe(false);
    expect(canManageMember('member', 'member')).toBe(false);
    expect(canManageMember(null, 'member')).toBe(false);
  });

  it('lets nobody manage the owner', () => {
    expect(canManageMember('owner', 'owner')).toBe(false);
    expect(canManageMember('admin', 'owner')).toBe(false);
  });

  it('knows the kinds of organization', () => {
    expect(isOrgKind('law_firm')).toBe(true);
    expect(isOrgKind('bank')).toBe(false);
    expect(isOrgKind(null)).toBe(false);
  });
});

describe('names and addresses', () => {
  it('tidies an email address', () => {
    expect(normalizeEmail('  Maria.Silva@Example.COM ')).toBe('maria.silva@example.com');
  });

  it('refuses what is not an address', () => {
    for (const value of ['', 'maria', 'maria@', '@example.com', 'maria@example', 'a b@example.com'])
      expect(normalizeEmail(value)).toBeNull();
    expect(normalizeEmail(`${'a'.repeat(250)}@example.com`)).toBeNull();
  });

  it('makes a slug from a name', () => {
    expect(orgSlug('Riverside Legal Aid')).toBe('riverside-legal-aid');
    expect(orgSlug('  École d’Été — Montréal!  ')).toBe('ecole-d-ete-montreal');
  });

  it('keeps a slug short and tidy at the cut', () => {
    const slug = orgSlug(`${'a'.repeat(47)} bcd`);
    expect(slug).toBe('a'.repeat(47));
  });

  it('still gives an address to a name with no Latin letters', () => {
    expect(orgSlug('移民学校')).toBe('org');
  });

  it('knows a real date from a made-up one', () => {
    expect(isIsoDate('2027-02-28')).toBe(true);
    expect(isIsoDate('2027-02-30')).toBe(false);
    expect(isIsoDate('2027-13-01')).toBe(false);
    expect(isIsoDate('02/28/2027')).toBe(false);
  });
});

describe('parseCsv', () => {
  it('reads quoted cells, doubled quotes and any line ending', () => {
    expect(parseCsv('\uFEFFa, b ,c\r\n"x, y","say ""hi""",z\rlast,,\n\n')).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'z'],
      ['last', '', ''],
    ]);
  });

  it('keeps a quote that is inside a cell', () => {
    expect(parseCsv('5" pipe,ok')).toEqual([['5" pipe', 'ok']]);
  });

  it('keeps line breaks inside quotes', () => {
    expect(parseCsv('"two\nlines",b')).toEqual([['two\nlines', 'b']]);
  });

  it('splits on another delimiter', () => {
    expect(parseCsv('a;b', ';')).toEqual([['a', 'b']]);
  });

  it('returns nothing for nothing', () => {
    expect(parseCsv('')).toEqual([]);
  });
});

describe('parseInviteList', () => {
  const countries = [
    { isoCode: 'US', name: 'United States' },
    { isoCode: 'CA', name: 'Canada' },
  ];
  const options = { countries, today: '2026-10-07' };

  it('reads a CSV with a header, columns in any order', () => {
    const list = parseInviteList(
      [
        'Full name,Target date,Email address,Country',
        'Maria Silva,2027-03-01,Maria@Example.com,US',
        '"Nguyen, Minh",2027/04/15,minh@example.com,canada',
        ',,lena@example.com,',
      ].join('\n'),
      options,
    );
    expect(list.problems).toEqual([]);
    expect(list.overLimit).toBe(0);
    expect(list.rows).toEqual([
      {
        email: 'maria@example.com',
        name: 'Maria Silva',
        countryCode: 'US',
        targetDate: '2027-03-01',
      },
      {
        email: 'minh@example.com',
        name: 'Nguyen, Minh',
        countryCode: 'CA',
        targetDate: '2027-04-15',
      },
      { email: 'lena@example.com', name: null, countryCode: null, targetDate: null },
    ]);
  });

  it('reads a header that names only some columns, and a row shorter than it', () => {
    const list = parseInviteList('Student email;Exam date;Exam\nmaria@example.com', options);
    expect(list.rows).toEqual([
      { email: 'maria@example.com', name: null, countryCode: null, targetDate: null },
    ]);
  });

  it('takes the name from "Name <address>" under a header', () => {
    const list = parseInviteList('email\nMaria Silva <maria@example.com>', options);
    expect(list.rows[0]).toMatchObject({ email: 'maria@example.com', name: 'Maria Silva' });
  });

  it('gives the defaults to lines that do not say otherwise', () => {
    const list = parseInviteList('email,country\na@example.com,\nb@example.com,CA', {
      ...options,
      defaultCountry: 'US',
      defaultTargetDate: '2027-01-01',
    });
    expect(list.rows).toEqual([
      { email: 'a@example.com', name: null, countryCode: 'US', targetDate: '2027-01-01' },
      { email: 'b@example.com', name: null, countryCode: 'CA', targetDate: '2027-01-01' },
    ]);
  });

  it('reads addresses pasted with no header, several to a line', () => {
    const list = parseInviteList('a@example.com, B@example.com\nc@example.com', options);
    expect(list.rows.map((row) => row.email)).toEqual([
      'a@example.com',
      'b@example.com',
      'c@example.com',
    ]);
  });

  it('reads addresses separated by semicolons or tabs', () => {
    expect(parseInviteList('a@example.com; b@example.com', options).rows).toHaveLength(2);
    expect(parseInviteList('a@example.com\tMaria', options).rows[0]).toMatchObject({
      name: 'Maria',
    });
  });

  it('works out the cells of a line with no header', () => {
    const list = parseInviteList(
      [
        'Maria Silva,maria@example.com,United States,2027-03-01',
        'minh@example.com,2027-05-01',
        'Lena Roth <lena@example.com>,Ignored name,ca',
        '<bare@example.com>',
      ].join('\n'),
      options,
    );
    expect(list.problems).toEqual([]);
    expect(list.rows).toEqual([
      {
        email: 'maria@example.com',
        name: 'Maria Silva',
        countryCode: 'US',
        targetDate: '2027-03-01',
      },
      { email: 'minh@example.com', name: null, countryCode: null, targetDate: '2027-05-01' },
      { email: 'lena@example.com', name: 'Lena Roth', countryCode: 'CA', targetDate: null },
      { email: 'bare@example.com', name: null, countryCode: null, targetDate: null },
    ]);
  });

  it('reports the lines it cannot use, and says why', () => {
    const list = parseInviteList(
      [
        'email,name,country,date',
        'not-an-address,Ann,,',
        'ok@example.com,,,',
        'OK@example.com,,,',
        'fr@example.com,,France,',
        'when@example.com,,,next spring',
        'day@example.com,,,2027-02-30',
        'late@example.com,,,2020-01-01',
      ].join('\n'),
      options,
    );
    expect(list.rows.map((row) => row.email)).toEqual(['ok@example.com']);
    expect(list.problems).toEqual([
      { line: 2, value: 'not-an-address, Ann', problem: 'bad-email' },
      { line: 4, value: 'ok@example.com', problem: 'duplicate' },
      { line: 5, value: 'France', problem: 'unknown-country' },
      { line: 6, value: 'next spring', problem: 'bad-date' },
      { line: 7, value: '2027-02-30', problem: 'bad-date' },
      { line: 8, value: '2020-01-01', problem: 'past-date' },
    ]);
  });

  it('reports a line with no address when there is no header', () => {
    const list = parseInviteList('a@example.com\njust a name\n01.02.2027,b@example.com', options);
    expect(list.rows.map((row) => row.email)).toEqual(['a@example.com']);
    expect(list.problems).toEqual([
      { line: 2, value: 'just a name', problem: 'bad-email' },
      { line: 3, value: '01.02.2027', problem: 'bad-date' },
    ]);
  });

  it('stops at the limit and says how many were left out', () => {
    const list = parseInviteList('a@example.com\nb@example.com\nc@example.com\na@example.com', {
      ...options,
      limit: 2,
    });
    expect(list.rows).toHaveLength(2);
    expect(list.overLimit).toBe(1);
    expect(list.problems).toEqual([{ line: 4, value: 'a@example.com', problem: 'duplicate' }]);
  });

  it('takes up to the standard limit by default', () => {
    const text = Array.from(
      { length: INVITE_LIST_LIMIT + 3 },
      (_, index) => `learner${index}@example.com`,
    ).join('\n');
    const list = parseInviteList(text, options);
    expect(list.rows).toHaveLength(INVITE_LIST_LIMIT);
    expect(list.overLimit).toBe(3);
  });

  it('cuts an overlong name', () => {
    const list = parseInviteList(`email,name\na@example.com,${'n'.repeat(200)}`, options);
    expect(list.rows[0]!.name).toHaveLength(120);
  });

  it('reads nothing from nothing', () => {
    expect(parseInviteList('', options)).toEqual({ rows: [], problems: [], overLimit: 0 });
  });
});

describe('seats', () => {
  const subscription = (seats: number, overrides = {}) => ({
    seats,
    status: 'active' as const,
    currentPeriodEnd: inDays(20),
    ...overrides,
  });

  it('adds the seats paid for to the seats granted', () => {
    expect(seatsInForce(null, [], now)).toBe(0);
    expect(seatsInForce(5, [], now)).toBe(5);
    expect(seatsInForce(5, [subscription(10)], now)).toBe(15);
    expect(seatsInForce(null, [subscription(10), subscription(3)], now)).toBe(13);
  });

  it('does not count a subscription that has ended', () => {
    expect(
      seatsInForce(
        2,
        [subscription(10, { status: 'canceled', currentPeriodEnd: inDays(-1) })],
        now,
      ),
    ).toBe(2);
    expect(seatsInForce(null, [subscription(4, { status: 'expired' })])).toBe(0);
  });

  it('counts a cancelled subscription until what was paid for runs out', () => {
    expect(seatsInForce(null, [subscription(10, { status: 'canceled' })], now)).toBe(10);
  });

  it('says what gives a learner their seat', () => {
    const long = subscription(2, { currentPeriodEnd: null });
    const short = subscription(2, { currentPeriodEnd: inDays(5) });
    const medium = subscription(1, { currentPeriodEnd: inDays(40) });
    // One granted seat, then the subscription that lasts longest, and so on.
    expect(seatSource(0, 1, [short, long, medium])).toBe('granted');
    expect(seatSource(1, 1, [short, long, medium])).toBe(long);
    expect(seatSource(2, 1, [short, long, medium])).toBe(long);
    expect(seatSource(3, 1, [short, long, medium])).toBe(medium);
    expect(seatSource(4, 1, [short, long, medium])).toBe(short);
    expect(seatSource(6, 1, [short, long, medium])).toBeNull();
    expect(seatSource(0, null, [])).toBeNull();
  });

  it('works out what is used, held by invitations, free and over', () => {
    expect(seatUsage({ seats: 10, learners: 4, pending: 3 })).toEqual({
      total: 10,
      used: 4,
      pending: 3,
      available: 3,
      over: 0,
    });
    expect(seatUsage({ seats: 3, learners: 5, pending: 1 })).toEqual({
      total: 3,
      used: 5,
      pending: 1,
      available: 0,
      over: 2,
    });
  });
});

describe('following learners', () => {
  const answer = (days: number, timeMs = 30_000) => ({
    questionId: 'q',
    correct: true,
    timeMs,
    answeredAt: daysAgo(days),
  });

  it('sums up what a learner has done', () => {
    expect(learnerActivity([answer(20), answer(3, 90_000), answer(1, 45_000)], now)).toEqual({
      lastActiveAt: daysAgo(1),
      answersThisWeek: 2,
      minutesThisWeek: 2,
      answers: 3,
    });
  });

  it('has nothing to say about a learner who has not started', () => {
    expect(learnerActivity([], now)).toEqual({
      lastActiveAt: null,
      answersThisWeek: 0,
      minutesThisWeek: 0,
      answers: 0,
    });
  });

  it('names how recently a learner studied', () => {
    expect(activityLevel(null, now)).toBe('never');
    expect(activityLevel(daysAgo(2), now)).toBe('active');
    expect(activityLevel(daysAgo(12), now)).toBe('quiet');
    expect(activityLevel(daysAgo(45), now)).toBe('inactive');
  });

  const standing = (overrides: Partial<Parameters<typeof learnerStanding>[0]>) =>
    learnerStanding(
      { score: 50, questionsSeen: 30, daysLeft: 30, lastActiveAt: daysAgo(1), ...overrides },
      now,
    );

  it('has not started without an answer or a score', () => {
    expect(standing({ questionsSeen: 0 })).toBe('not_started');
    expect(standing({ score: null })).toBe('not_started');
  });

  it('is ready at the ready score, whatever the date', () => {
    expect(standing({ score: READY_SCORE, daysLeft: -5 })).toBe('ready');
  });

  it('is on track without a date to be behind on', () => {
    expect(standing({ score: 10, daysLeft: null, lastActiveAt: daysAgo(90) })).toBe('on_track');
  });

  it('is on track when a steady pace gets there in time', () => {
    expect(standing({ score: 20, daysLeft: 30 })).toBe('on_track');
    expect(standing({ score: 60, daysLeft: 10 })).toBe('on_track');
  });

  it('is behind when it does not', () => {
    expect(standing({ score: 59, daysLeft: 10 })).toBe('behind');
    expect(standing({ score: 79, daysLeft: -3 })).toBe('behind');
  });

  it('is behind after two weeks without studying, with a date set', () => {
    expect(standing({ score: 70, daysLeft: 30, lastActiveAt: daysAgo(15) })).toBe('behind');
    expect(standing({ score: 70, daysLeft: 30, lastActiveAt: null })).toBe('behind');
  });

  it('sums up an organization', () => {
    expect(
      summarizeLearners([
        { standing: 'ready', activity: 'active', score: 90 },
        { standing: 'behind', activity: 'quiet', score: 41 },
        { standing: 'on_track', activity: 'active', score: 60 },
        { standing: 'not_started', activity: 'never', score: null },
      ]),
    ).toEqual({
      learners: 4,
      started: 3,
      ready: 1,
      behind: 1,
      activeThisWeek: 2,
      averageReadiness: 64,
    });
  });

  it('has no average before anyone has started', () => {
    expect(summarizeLearners([]).averageReadiness).toBeNull();
  });
});

describe('reports', () => {
  it('writes cells a spreadsheet reads back as they were', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(72)).toBe('72');
    expect(csvCell(-3)).toBe('-3');
    expect(csvCell('Maria')).toBe('Maria');
    expect(csvCell('Silva, Maria')).toBe('"Silva, Maria"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('does not let a name run as a formula', () => {
    expect(csvCell('=HYPERLINK("http://evil.test")')).toBe(`"'=HYPERLINK(""http://evil.test"")"`);
    expect(csvCell('+1 555 0100')).toBe("'+1 555 0100");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@sum')).toBe("'@sum");
  });

  it('writes rows as lines', () => {
    expect(
      toCsv([
        ['Name', 'Readiness'],
        ['Maria', 72],
        ['Minh', null],
      ]),
    ).toBe('Name,Readiness\r\nMaria,72\r\nMinh,\r\n');
  });
});

describe('logos', () => {
  const bytes = (...values: number[]) => Uint8Array.from([...values, 0, 0, 0, 0]);

  it('tells an image by its first bytes, not its name', () => {
    expect(logoType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(logoType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(logoType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe(
      'image/webp',
    );
  });

  it('refuses anything else', () => {
    // RIFF, but a WAV.
    expect(logoType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45))).toBeNull();
    const svg = Uint8Array.from('<svg onload="alert(1)">', (char) => char.charCodeAt(0));
    expect(logoType(svg)).toBeNull();
    expect(logoType(new Uint8Array())).toBeNull();
  });
});
