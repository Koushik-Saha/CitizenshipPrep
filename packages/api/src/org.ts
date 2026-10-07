// zod/mini: these schemas run in the browser and on phones.
import {
  orgRoles,
  type ActivityLevel,
  type LearnerStanding,
  type LearnerSummary,
  type OrgKind,
  type OrgRole,
  type SeatUsage,
  type SubscriptionStatus,
} from '@oathly/core';
import * as z from 'zod/mini';

// Organizations as the apps see them. A learner's apps need only the
// membership (who they study with, and that organization's look); the
// console that admins use is drawn on the server from the views below.

/** An organization's look: what white-label puts on its learners' dashboards. */
export const orgBrandSchema = z.object({
  color: z.nullable(z.string()),
  accent: z.nullable(z.string()),
  /** Changes when the logo does; null without a logo. */
  logoVersion: z.nullable(z.string()),
});

/** One organization the signed-in person belongs to. */
export const membershipSchema = z.object({
  organizationId: z.string(),
  name: z.string(),
  slug: z.string(),
  role: z.enum(orgRoles),
  brand: orgBrandSchema,
  /** What the organization has asked this learner to prepare for. */
  countryCode: z.nullable(z.string()),
  targetDate: z.nullable(z.string()),
});

export type OrgBrand = z.infer<typeof orgBrandSchema>;
export type Membership = z.infer<typeof membershipSchema>;

/** Whether an organization has chosen any look of its own. */
export function hasBrand(brand: OrgBrand): boolean {
  return Boolean(brand.color || brand.accent || brand.logoVersion);
}

/**
 * The organization whose look a learner's dashboard takes: the first one
 * they joined as a learner that has one. Admins see Oathly as it is.
 */
export function brandingMembership(memberships: readonly Membership[]): Membership | null {
  return (
    memberships.find((membership) => membership.role === 'member' && hasBrand(membership.brand)) ??
    null
  );
}

/** Where an organization's logo is served from, under an app's API base. */
export function orgLogoPath(organizationId: string, version: string): string {
  return `/api/orgs/${organizationId}/logo?v=${version}`;
}

// The console ---------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  kind: OrgKind;
  brand: OrgBrand;
}

/** The seats an organization has, and the subscription behind them. */
export interface OrgSeats extends SeatUsage {
  /** Seats given by Oathly staff rather than bought. */
  granted: number;
  /** The Stripe subscription, if there is one. */
  subscription: {
    seats: number;
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    inForce: boolean;
  } | null;
}

/** An invitation not yet accepted. */
export interface OrgInvite {
  id: string;
  email: string;
  name: string | null;
  role: Exclude<OrgRole, 'owner'>;
  countryCode: string | null;
  targetDate: string | null;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
}

/** Someone who runs the organization. */
export interface OrgStaff {
  userId: string;
  name: string | null;
  email: string | null;
  role: 'owner' | 'admin';
}

/** One learner, as their organization's admins see them. */
export interface OrgLearner {
  userId: string;
  /** The name the organization knows them by, or the one they gave Oathly. */
  name: string | null;
  email: string | null;
  countryCode: string | null;
  countryName: string | null;
  targetDate: string | null;
  /** Whole days until the target date; negative once it has passed. */
  daysLeft: number | null;
  joinedAt: string;
  /** False when the organization has more learners than seats and this one is beyond them. */
  hasSeat: boolean;
  /** 0 to 100; null until the country has questions to measure against. */
  readiness: number | null;
  /** True until enough has been practised for the score to mean much. */
  isEarlyEstimate: boolean;
  questionsSeen: number;
  lastActiveAt: string | null;
  answersThisWeek: number;
  minutesThisWeek: number;
  answers: number;
  mockExams: number;
  /** Share of the latest mock exam answered correctly, 0 to 100. */
  lastMockPercent: number | null;
  activity: ActivityLevel;
  standing: LearnerStanding;
}

export interface OrgReport {
  organization: Organization;
  generatedAt: string;
  summary: LearnerSummary;
  learners: OrgLearner[];
}

/** Why something asked of an organization was refused. */
export type OrgProblem =
  /** No such organization, or not one the caller belongs to. */
  | 'not-found'
  /** The caller's role does not allow it. */
  | 'forbidden'
  /** The name, colour, country or date given cannot be used. */
  | 'invalid'
  /** The invitation has expired or been withdrawn. */
  | 'invite-gone'
  /** The invitation was sent to a different address than the one signed in. */
  | 'wrong-address'
  /** The file is not a PNG, JPEG or WebP image, or is too large. */
  | 'bad-logo';

/** The columns of the exported report, in order. Headings are translated by the caller. */
export const reportColumns = [
  'name',
  'email',
  'country',
  'targetDate',
  'daysLeft',
  'readiness',
  'standing',
  'lastActive',
  'answersThisWeek',
  'minutesThisWeek',
  'answers',
  'mockExams',
  'lastMock',
  'joined',
] as const;
export type ReportColumn = (typeof reportColumns)[number];

/** One learner as a row of the exported report: plain values, dates as YYYY-MM-DD. */
export function reportRow(
  learner: OrgLearner,
  standingLabel: (standing: LearnerStanding) => string,
): Record<ReportColumn, string | number | null> {
  return {
    name: learner.name,
    email: learner.email,
    country: learner.countryName ?? learner.countryCode,
    targetDate: learner.targetDate,
    daysLeft: learner.daysLeft,
    readiness: learner.readiness,
    standing: standingLabel(learner.standing),
    lastActive: learner.lastActiveAt?.slice(0, 10) ?? null,
    answersThisWeek: learner.answersThisWeek,
    minutesThisWeek: learner.minutesThisWeek,
    answers: learner.answers,
    mockExams: learner.mockExams,
    lastMock: learner.lastMockPercent,
    joined: learner.joinedAt.slice(0, 10),
  };
}

/** How the learner list can be ordered. */
export const learnerSorts = ['attention', 'name', 'readiness', 'date', 'activity'] as const;
export type LearnerSort = (typeof learnerSorts)[number];

const standingOrder: Record<LearnerStanding, number> = {
  behind: 0,
  not_started: 1,
  on_track: 2,
  ready: 3,
};

/** Learners in the order asked for. "attention" puts those who need a nudge first. */
export function sortLearners(learners: readonly OrgLearner[], sort: LearnerSort): OrgLearner[] {
  const name = (learner: OrgLearner) => (learner.name ?? learner.email ?? '').toLowerCase();
  const byName = (a: OrgLearner, b: OrgLearner) => name(a).localeCompare(name(b));
  const nullsLast = (a: number | string | null, b: number | string | null, order: 1 | -1) =>
    a === b ? 0 : a === null ? 1 : b === null ? -1 : (a < b ? -1 : 1) * order;
  const compare: Record<LearnerSort, (a: OrgLearner, b: OrgLearner) => number> = {
    name: byName,
    readiness: (a, b) => nullsLast(a.readiness, b.readiness, -1),
    date: (a, b) => nullsLast(a.targetDate, b.targetDate, 1),
    activity: (a, b) => nullsLast(a.lastActiveAt, b.lastActiveAt, -1),
    attention: (a, b) =>
      standingOrder[a.standing] - standingOrder[b.standing] || nullsLast(a.daysLeft, b.daysLeft, 1),
  };
  return [...learners].sort((a, b) => compare[sort](a, b) || byName(a, b));
}
