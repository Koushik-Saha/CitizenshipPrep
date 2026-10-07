import { isInForce, type SubscriptionStatus } from './access';
import type { AnswerEvent } from './types';

// Organizations: a law firm, school or nonprofit that invites learners,
// gives each a country and a target date, and follows how ready they are.
// The rules are here; the server stores and the apps draw.

const DAY_MS = 24 * 60 * 60 * 1000;

// Roles -----------------------------------------------------------------------

export const orgRoles = ['owner', 'admin', 'member'] as const;
export type OrgRole = (typeof orgRoles)[number];

export const orgKinds = ['law_firm', 'school', 'nonprofit', 'other'] as const;
export type OrgKind = (typeof orgKinds)[number];

export function isOrgKind(value: unknown): value is OrgKind {
  return (orgKinds as readonly unknown[]).includes(value);
}

/** Whether a role runs the organization: sees its learners, invites, assigns. */
export function isOrgAdmin(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Whether someone may change or remove another member. The owner manages
 * everyone else; an admin manages learners; nobody removes the owner.
 */
export function canManageMember(actor: OrgRole | null | undefined, target: OrgRole): boolean {
  if (target === 'owner') return false;
  return actor === 'owner' || (actor === 'admin' && target === 'member');
}

// Names and addresses -----------------------------------------------------------

/** An email address trimmed and lower-cased, or null if it is not one. */
export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^@\s<>"',;]+@[^@\s<>"',;]+\.[^@\s<>"',;.]+$/.test(email)
    ? email
    : null;
}

/** A URL slug for an organization's name: "Riverside Legal Aid" → "riverside-legal-aid". */
export function orgSlug(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  // A name with no Latin letters or digits still needs an address.
  return slug || 'org';
}

/** Whether a string is a real calendar date written YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Invitation lists --------------------------------------------------------------

/** Splits CSV text into rows of cells: quoted cells, doubled quotes, any line ending. */
export function parseCsv(text: string, delimiter: string = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (quoted) {
      if (char !== '"') cell += char;
      else if (source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = false;
    } else if (char === '"' && cell.trim() === '') {
      cell = '';
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  row.push(cell.trim());
  rows.push(row);
  return rows.filter((cells) => cells.some((value) => value !== ''));
}

/** One learner to invite. */
export interface InviteRow {
  email: string;
  name: string | null;
  countryCode: string | null;
  /** YYYY-MM-DD. */
  targetDate: string | null;
}

export type InviteProblem =
  /** No email address on the line, or one that is not an address. */
  | 'bad-email'
  /** The same address appears earlier in the list. */
  | 'duplicate'
  /** A country Oathly has no exam for, or does not recognise. */
  | 'unknown-country'
  /** A date not written YYYY-MM-DD, or not a real day. */
  | 'bad-date'
  /** A target date that has already passed. */
  | 'past-date';

export interface InviteListProblem {
  /** The line of the list, counting from 1. */
  line: number;
  /** What was found there, to show back. */
  value: string;
  problem: InviteProblem;
}

export interface InviteList {
  rows: InviteRow[];
  /** Lines left out, and why. */
  problems: InviteListProblem[];
  /** How many good lines were left out for being past the limit. */
  overLimit: number;
}

export interface InviteListOptions {
  /** The countries learners can be assigned. */
  countries: readonly { isoCode: string; name: string }[];
  /** Given to every line that does not say otherwise. */
  defaultCountry?: string | null;
  defaultTargetDate?: string | null;
  /** Today, YYYY-MM-DD: target dates are in the future. */
  today: string;
  /** The most learners one list may invite. */
  limit?: number;
}

export const INVITE_LIST_LIMIT = 500;

const HEADERS = {
  email: /e-?mail/,
  name: /^(full ?name|name|learner|student|client)/,
  country: /^(country|exam|test)/,
  date: /^(target|date|exam ?date|test ?date|deadline)/,
} as const;
type Column = keyof typeof HEADERS;

/** Which column each kind of value is in, when the first row is a header. */
function headerColumns(cells: readonly string[]): Partial<Record<Column, number>> | null {
  const columns: Partial<Record<Column, number>> = {};
  cells.forEach((cell, index) => {
    const label = cell.toLowerCase();
    // "Target date" is a date and "Exam date" is too, before either is a country.
    const column = (['email', 'name', 'date', 'country'] as const).find((candidate) =>
      HEADERS[candidate].test(label),
    );
    if (column) columns[column] ??= index;
  });
  return columns.email === undefined ? null : columns;
}

/** "Maria Silva <maria@example.com>" as its parts. */
function addressParts(cell: string): { email: string | null; name: string | null } {
  const angled = /^(.*)<([^<>]+)>$/.exec(cell);
  if (!angled) return { email: normalizeEmail(cell), name: null };
  return { email: normalizeEmail(angled[2]!), name: angled[1]!.trim() || null };
}

/**
 * Reads a list of learners to invite: a CSV file with a header row (email,
 * and optionally name, country, target date, in any order), or addresses
 * typed or pasted, one or several to a line. Lines that cannot be used are
 * reported rather than guessed at.
 */
export function parseInviteList(text: string, options: InviteListOptions): InviteList {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0]!;
  const delimiter = [';', '\t'].find((candidate) => firstLine.includes(candidate)) ?? ',';
  const lines = parseCsv(text, delimiter);
  const header = lines[0] ? headerColumns(lines[0]) : null;
  const limit = options.limit ?? INVITE_LIST_LIMIT;

  const countryByKey = new Map<string, string>();
  for (const country of options.countries) {
    countryByKey.set(country.isoCode.toLowerCase(), country.isoCode);
    countryByKey.set(country.name.toLowerCase(), country.isoCode);
  }

  const result: InviteList = { rows: [], problems: [], overLimit: 0 };
  const seen = new Set<string>();
  const add = (
    line: number,
    raw: string,
    entry: { email: string | null; name: string | null; country: string; date: string },
  ) => {
    const problem = (kind: InviteProblem, value: string) =>
      result.problems.push({ line, value, problem: kind });
    if (!entry.email) return problem('bad-email', raw);
    if (seen.has(entry.email)) return problem('duplicate', entry.email);

    let countryCode = options.defaultCountry ?? null;
    if (entry.country) {
      const known = countryByKey.get(entry.country.toLowerCase());
      if (!known) return problem('unknown-country', entry.country);
      countryCode = known;
    }
    let targetDate = options.defaultTargetDate ?? null;
    if (entry.date) {
      const date = entry.date.replace(/\//g, '-');
      if (!isIsoDate(date)) return problem('bad-date', entry.date);
      if (date < options.today) return problem('past-date', entry.date);
      targetDate = date;
    }

    seen.add(entry.email);
    if (result.rows.length >= limit) {
      result.overLimit += 1;
      return;
    }
    result.rows.push({
      email: entry.email,
      name: entry.name?.slice(0, 120) || null,
      countryCode,
      targetDate,
    });
  };

  lines.slice(header ? 1 : 0).forEach((cells, index) => {
    const line = index + (header ? 2 : 1);
    const raw = cells.filter(Boolean).join(', ');
    if (header) {
      const cell = (column: Column) =>
        header[column] === undefined ? '' : (cells[header[column]] ?? '');
      const address = addressParts(cell('email'));
      add(line, raw, {
        email: address.email,
        name: cell('name') || address.name,
        country: cell('country'),
        date: cell('date'),
      });
      return;
    }

    // No header: find the address, then work out what the other cells are.
    const addresses = cells.map(addressParts);
    const emails = addresses.filter((address) => address.email);
    if (emails.length !== 1) {
      // Several addresses on a line are several learners; none is a mistake.
      if (emails.length === 0) add(line, raw, { email: null, name: null, country: '', date: '' });
      for (const address of emails) add(line, raw, { ...address, country: '', date: '' });
      return;
    }
    const rest = cells.filter((cell, position) => cell && !addresses[position]!.email);
    const date = rest.find((cell) => /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(cell)) ?? '';
    const country =
      rest.find((cell) => cell !== date && countryByKey.has(cell.toLowerCase())) ?? '';
    const name = rest.find((cell) => cell !== date && cell !== country) ?? null;
    add(line, raw, { email: emails[0]!.email, name: emails[0]!.name ?? name, country, date });
  });
  return result;
}

// Seats -----------------------------------------------------------------------

/** An organization's subscription, as far as seats go. */
export interface SeatSubscription {
  seats: number;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
}

/** The seats an organization has now: those granted by staff plus those paid for and in force. */
export function seatsInForce(
  granted: number | null,
  subscriptions: readonly SeatSubscription[],
  now: Date = new Date(),
): number {
  return subscriptions
    .filter((subscription) => isInForce(subscription, now))
    .reduce((total, subscription) => total + subscription.seats, granted ?? 0);
}

/**
 * What gives a learner their seat: "granted" (by staff), one of the
 * organization's subscriptions, or null when the seats run out before them.
 * `rank` is how many learners joined before this one. Granted seats are
 * filled first, then the subscription that lasts longest.
 */
export function seatSource<S extends SeatSubscription>(
  rank: number,
  granted: number | null,
  subscriptions: readonly S[],
): 'granted' | S | null {
  let covered = granted ?? 0;
  if (rank < covered) return 'granted';
  const end = (subscription: S) =>
    subscription.currentPeriodEnd === null ? Infinity : Date.parse(subscription.currentPeriodEnd);
  for (const subscription of [...subscriptions].sort((a, b) => end(b) - end(a))) {
    covered += subscription.seats;
    if (rank < covered) return subscription;
  }
  return null;
}

export interface SeatUsage {
  /** Seats the organization has. */
  total: number;
  /** Learners who have joined. */
  used: number;
  /** Invitations out: each holds a seat until it is accepted, revoked or expires. */
  pending: number;
  /** Seats free to invite into. */
  available: number;
  /** Learners beyond the seats there are, who study on the Free plan meanwhile. */
  over: number;
}

export function seatUsage(input: { seats: number; learners: number; pending: number }): SeatUsage {
  return {
    total: input.seats,
    used: input.learners,
    pending: input.pending,
    available: Math.max(0, input.seats - input.learners - input.pending),
    over: Math.max(0, input.learners - input.seats),
  };
}

// Following learners --------------------------------------------------------------

/** What a learner has done, for the people supporting them. */
export interface LearnerActivity {
  lastActiveAt: Date | null;
  /** Answers given in the last seven days. */
  answersThisWeek: number;
  /** Whole minutes spent answering in the last seven days. */
  minutesThisWeek: number;
  /** Answers given in all. */
  answers: number;
}

export function learnerActivity(history: readonly AnswerEvent[], now: Date): LearnerActivity {
  const weekAgo = now.getTime() - 7 * DAY_MS;
  const recent = history.filter((event) => event.answeredAt.getTime() >= weekAgo);
  const last = history.reduce(
    (latest, event) => Math.max(latest, event.answeredAt.getTime()),
    -Infinity,
  );
  return {
    lastActiveAt: history.length === 0 ? null : new Date(last),
    answersThisWeek: recent.length,
    minutesThisWeek: Math.floor(recent.reduce((sum, event) => sum + event.timeMs, 0) / 60_000),
    answers: history.length,
  };
}

export type ActivityLevel =
  /** Studied in the last week. */
  | 'active'
  /** Studied in the last month, not the last week. */
  | 'quiet'
  /** Has not studied for over a month. */
  | 'inactive'
  /** Has not answered a question yet. */
  | 'never';

export function activityLevel(lastActiveAt: Date | null, now: Date): ActivityLevel {
  if (!lastActiveAt) return 'never';
  const days = (now.getTime() - lastActiveAt.getTime()) / DAY_MS;
  return days <= 7 ? 'active' : days <= 30 ? 'quiet' : 'inactive';
}

/** The readiness score at which a learner is counted as ready. */
export const READY_SCORE = 80;
/** Points of readiness a learner who keeps studying can be expected to gain in a day. */
export const EXPECTED_DAILY_GAIN = 2;
/** With a date set, this many days without studying is falling behind. */
export const STALLED_AFTER_DAYS = 14;

export type LearnerStanding =
  /** Has not answered a question yet. */
  | 'not_started'
  | 'ready'
  | 'on_track'
  /** At a steady pace they would not be ready by their date, or they have stopped. */
  | 'behind';

/**
 * Where a learner stands against their target date. Without a date there is
 * nothing to be behind on.
 */
export function learnerStanding(
  input: {
    /** The readiness score, 0 to 100; null when there is nothing to measure. */
    score: number | null;
    /** Distinct questions answered. */
    questionsSeen: number;
    /** Whole days until the target date (negative once it has passed); null without one. */
    daysLeft: number | null;
    lastActiveAt: Date | null;
  },
  now: Date,
): LearnerStanding {
  if (input.score === null || input.questionsSeen === 0) return 'not_started';
  if (input.score >= READY_SCORE) return 'ready';
  if (input.daysLeft === null) return 'on_track';
  const needed = READY_SCORE - EXPECTED_DAILY_GAIN * Math.max(0, input.daysLeft);
  const idleDays =
    input.lastActiveAt === null
      ? Infinity
      : (now.getTime() - input.lastActiveAt.getTime()) / DAY_MS;
  return input.score < needed || idleDays > STALLED_AFTER_DAYS ? 'behind' : 'on_track';
}

/** The numbers at the top of an organization's report. */
export interface LearnerSummary {
  learners: number;
  /** Have answered at least one question. */
  started: number;
  ready: number;
  behind: number;
  activeThisWeek: number;
  /** Mean readiness of the learners who have started; null if none has. */
  averageReadiness: number | null;
}

export function summarizeLearners(
  learners: readonly {
    standing: LearnerStanding;
    activity: ActivityLevel;
    score: number | null;
  }[],
): LearnerSummary {
  const started = learners.filter((learner) => learner.standing !== 'not_started');
  const count = (standing: LearnerStanding) =>
    learners.filter((learner) => learner.standing === standing).length;
  return {
    learners: learners.length,
    started: started.length,
    ready: count('ready'),
    behind: count('behind'),
    activeThisWeek: learners.filter((learner) => learner.activity === 'active').length,
    averageReadiness:
      started.length === 0
        ? null
        : Math.round(started.reduce((sum, learner) => sum + learner.score!, 0) / started.length),
  };
}

// Reports -----------------------------------------------------------------------

/**
 * One CSV cell. Text that a spreadsheet would run as a formula ("=…", "+…",
 * "-…", "@…") is made plain text: names and addresses come from people.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows as CSV text, one line each, in the line endings spreadsheets expect. */
export function toCsv(rows: readonly (readonly (string | number | null)[])[]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// Logos -------------------------------------------------------------------------

export const MAX_LOGO_BYTES = 256 * 1024;
export type LogoType = 'image/png' | 'image/jpeg' | 'image/webp';

/** What kind of image a file really is, from its first bytes; null if not one we take. */
export function logoType(bytes: Uint8Array): LogoType | null {
  const starts = (signature: readonly number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}
