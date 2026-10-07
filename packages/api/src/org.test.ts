import { describe, expect, it } from 'vitest';

import {
  brandingMembership,
  hasBrand,
  orgLogoPath,
  reportColumns,
  reportRow,
  sortLearners,
  type Membership,
  type OrgLearner,
} from './org';

const membership = (overrides: Partial<Membership> = {}): Membership => ({
  organizationId: 'org-1',
  name: 'Riverside Legal Aid',
  slug: 'riverside',
  role: 'member',
  brand: { color: null, accent: null, logoVersion: null },
  countryCode: null,
  targetDate: null,
  ...overrides,
});

const learner = (overrides: Partial<OrgLearner> = {}): OrgLearner => ({
  userId: 'u1',
  name: 'Maria Silva',
  email: 'maria@example.com',
  countryCode: 'US',
  countryName: 'United States',
  targetDate: '2027-03-01',
  daysLeft: 145,
  joinedAt: '2026-09-01T10:00:00.000Z',
  hasSeat: true,
  readiness: 62,
  isEarlyEstimate: false,
  questionsSeen: 80,
  lastActiveAt: '2026-10-06T08:30:00.000Z',
  answersThisWeek: 40,
  minutesThisWeek: 25,
  answers: 300,
  mockExams: 2,
  lastMockPercent: 85,
  activity: 'active',
  standing: 'on_track',
  ...overrides,
});

describe('white-label', () => {
  it('knows whether an organization has a look of its own', () => {
    expect(hasBrand({ color: null, accent: null, logoVersion: null })).toBe(false);
    expect(hasBrand({ color: '#0b5fff', accent: null, logoVersion: null })).toBe(true);
    expect(hasBrand({ color: null, accent: '#ff6f00', logoVersion: null })).toBe(true);
    expect(hasBrand({ color: null, accent: null, logoVersion: 'abc' })).toBe(true);
  });

  it('dresses a learner’s dashboard in their organization’s look', () => {
    const plain = membership();
    const branded = membership({
      organizationId: 'org-2',
      brand: { color: '#0b5fff', accent: null, logoVersion: null },
    });
    expect(brandingMembership([plain, branded])).toBe(branded);
    expect(brandingMembership([plain])).toBeNull();
    expect(brandingMembership([])).toBeNull();
  });

  it('leaves an admin’s dashboard as Oathly', () => {
    const admin = membership({
      role: 'admin',
      brand: { color: '#0b5fff', accent: null, logoVersion: 'abc' },
    });
    expect(brandingMembership([admin])).toBeNull();
  });

  it('addresses a logo by its version, so it can be cached for good', () => {
    expect(orgLogoPath('org-1', 'abc123')).toBe('/api/orgs/org-1/logo?v=abc123');
  });
});

describe('the exported report', () => {
  it('writes a learner as plain values in the report’s columns', () => {
    const row = reportRow(learner(), (standing) => standing.toUpperCase());
    expect(Object.keys(row)).toEqual([...reportColumns]);
    expect(row).toEqual({
      name: 'Maria Silva',
      email: 'maria@example.com',
      country: 'United States',
      targetDate: '2027-03-01',
      daysLeft: 145,
      readiness: 62,
      standing: 'ON_TRACK',
      lastActive: '2026-10-06',
      answersThisWeek: 40,
      minutesThisWeek: 25,
      answers: 300,
      mockExams: 2,
      lastMock: 85,
      joined: '2026-09-01',
    });
  });

  it('leaves blank what there is nothing to say about', () => {
    const row = reportRow(
      learner({ countryName: null, countryCode: null, lastActiveAt: null, readiness: null }),
      String,
    );
    expect(row).toMatchObject({ country: null, lastActive: null, readiness: null });
    expect(reportRow(learner({ countryName: null }), String).country).toBe('US');
  });
});

describe('sortLearners', () => {
  const ana = learner({ userId: 'a', name: 'Ana', readiness: 90, standing: 'ready', daysLeft: 5 });
  const ben = learner({
    userId: 'b',
    name: 'ben',
    readiness: 30,
    standing: 'behind',
    daysLeft: 10,
    targetDate: '2026-10-17',
    lastActiveAt: '2026-09-01T00:00:00.000Z',
  });
  const cai = learner({
    userId: 'c',
    name: null,
    email: 'cai@example.com',
    readiness: null,
    standing: 'not_started',
    daysLeft: null,
    targetDate: null,
    lastActiveAt: null,
  });
  const dee = learner({
    userId: 'd',
    name: 'Dee',
    readiness: 30,
    standing: 'behind',
    daysLeft: 3,
    targetDate: '2026-10-10',
  });
  const nobody = learner({ userId: 'e', name: null, email: null, standing: 'ready', daysLeft: 5 });
  const all = [cai, ana, dee, ben];
  const order = (sort: Parameters<typeof sortLearners>[1], list = all) =>
    sortLearners(list, sort).map((entry) => entry.userId);

  it('puts those who need attention first, the nearest date leading', () => {
    expect(order('attention')).toEqual(['d', 'b', 'c', 'a']);
  });

  it('orders by name, whatever the case, falling back to the address', () => {
    expect(order('name')).toEqual(['a', 'b', 'c', 'd']);
    expect(order('name', [ana, nobody])).toEqual(['e', 'a']);
  });

  it('orders by readiness, highest first, the unmeasured last', () => {
    expect(order('readiness')).toEqual(['a', 'b', 'd', 'c']);
  });

  it('orders by target date, soonest first, the dateless last', () => {
    expect(order('date')).toEqual(['d', 'b', 'a', 'c']);
    expect(order('date', [cai, cai])).toEqual(['c', 'c']);
  });

  it('orders by who studied most recently, never-studied last', () => {
    expect(order('activity')).toEqual(['a', 'd', 'b', 'c']);
    expect(order('activity', [cai, ben])).toEqual(['b', 'c']);
  });

  it('does not reorder the list it was given', () => {
    order('name');
    expect(all.map((entry) => entry.userId)).toEqual(['c', 'a', 'd', 'b']);
  });
});
