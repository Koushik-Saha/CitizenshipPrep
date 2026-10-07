import { createHash, randomBytes } from 'node:crypto';

import {
  accessibleQuestions,
  activityLevel,
  canManageMember,
  isInForce,
  isIsoDate,
  isOrgAdmin,
  isOrgKind,
  learnerActivity,
  learnerStanding,
  logoType,
  MAX_LOGO_BYTES,
  normalizeEmail,
  orgSlug,
  seatSource,
  seatsInForce,
  seatUsage,
  summarizeLearners,
  type AnswerEvent,
  type InviteRow,
  type LogoType,
  type OrgKind,
  type OrgRole,
  type QuizQuestion,
} from '@oathly/core';
import type pg from 'pg';

import { daysUntilExam } from '../me';
import type {
  Membership,
  Organization,
  OrgInvite,
  OrgLearner,
  OrgProblem,
  OrgReport,
  OrgSeats,
  OrgStaff,
} from '../org';
import { entitlementsFor, teamSubscriptions } from './billing';
import { loadExamFormats, loadQuestionPool, type CountryExamFormat } from './quiz';
import { measureReadiness, type MockRow } from './study';

// Organizations on the server. These run on the owner connection, which row
// level security does not bind, so every function that reads or changes an
// organization first checks the caller's role in that organization, and
// reports only on that organization's members. The user ids passed in must
// come from a verified session.

type Db = Pick<pg.Pool, 'query'>;

/** Something asked of an organization that cannot be done; `problem` says why. */
export class OrgError extends Error {
  override readonly name = 'OrgError';
  constructor(readonly problem: OrgProblem) {
    super(problem);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_COLOR = /^#[0-9a-f]{6}$/;
/** How long an invitation can be accepted for. */
export const INVITE_DAYS = 30;

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

async function transaction<T>(pool: pg.Pool, run: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await run(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

// Organizations -------------------------------------------------------------------

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  kind: OrgKind;
  brand_color: string | null;
  brand_accent: string | null;
  logo_version: string | null;
  seat_limit: number | null;
}

const ORG_COLUMNS = `o.id, o.name, o.slug, o.kind, o.brand_color, o.brand_accent, o.seat_limit,
       (select l.version from public.org_logos l where l.organization_id = o.id) as logo_version`;

const toOrganization = (row: OrgRow): Organization => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  kind: row.kind,
  brand: { color: row.brand_color, accent: row.brand_accent, logoVersion: row.logo_version },
});

/** The organizations someone belongs to, oldest membership first. */
export async function listMemberships(db: Db, userId: string): Promise<Membership[]> {
  const { rows } = await db.query<
    OrgRow & { role: OrgRole; country_code: string | null; target_date: string | null }
  >(
    `select ${ORG_COLUMNS}, m.role, m.country_code,
            to_char(m.target_date, 'YYYY-MM-DD') as target_date
     from public.org_members m
     join public.organizations o on o.id = m.organization_id
     where m.user_id = $1
     order by m.created_at, o.id`,
    [userId],
  );
  return rows.map((row) => ({
    organizationId: row.id,
    name: row.name,
    slug: row.slug,
    role: row.role,
    brand: toOrganization(row).brand,
    countryCode: row.country_code,
    targetDate: row.target_date,
  }));
}

/** Creates an organization, owned by whoever asked. */
export async function createOrganization(
  db: Db,
  userId: string,
  input: { name: string; kind: string; email?: string | null },
): Promise<Organization> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 120 || !isOrgKind(input.kind)) throw new OrgError('invalid');
  const base = orgSlug(name);
  // "riverside", then "riverside-2", … and something random if those are all taken.
  const candidates = [
    base,
    ...Array.from({ length: 8 }, (_, index) => `${base}-${index + 2}`),
    `${base}-${randomBytes(4).toString('hex')}`,
  ];
  for (const slug of candidates) {
    // The trigger on organizations makes the creator its owner.
    const { rows } = await db.query<{ id: string }>(
      `insert into public.organizations (name, slug, kind, created_by) values ($1, $2, $3, $4)
       on conflict (slug) do nothing
       returning id`,
      [name, slug, input.kind, userId],
    );
    if (rows[0]) {
      // So fellow admins can tell who the owner is.
      const email = input.email ? normalizeEmail(input.email) : null;
      if (email) {
        await db.query(
          'update public.org_members set email = $3 where organization_id = $1 and user_id = $2',
          [rows[0].id, userId, email],
        );
      }
      return {
        id: rows[0].id,
        name,
        slug,
        kind: input.kind,
        brand: { color: null, accent: null, logoVersion: null },
      };
    }
  }
  throw new OrgError('invalid');
}

/** An organization as one of its members reaches it. */
export interface OrgAccess {
  organization: Organization;
  role: OrgRole;
  /** Seats given by staff. */
  granted: number;
}

/** The organization with this slug or id, if the caller belongs to it. */
export async function getOrgAccess(
  db: Db,
  userId: string,
  key: { slug: string } | { id: string },
): Promise<OrgAccess | null> {
  if ('id' in key && !UUID.test(key.id)) return null;
  const { rows } = await db.query<OrgRow & { role: OrgRole }>(
    `select ${ORG_COLUMNS}, m.role
     from public.organizations o
     join public.org_members m on m.organization_id = o.id and m.user_id = $1
     where ${'id' in key ? 'o.id = $2' : 'o.slug = $2'}`,
    [userId, 'id' in key ? key.id : key.slug],
  );
  const row = rows[0];
  return row
    ? { organization: toOrganization(row), role: row.role, granted: row.seat_limit ?? 0 }
    : null;
}

/**
 * The organization, for someone who runs it. Anyone else is refused: an
 * outsider is told it does not exist, a learner that it is not theirs to run.
 */
export async function requireOrgAdmin(
  db: Db,
  userId: string,
  organizationId: string,
): Promise<OrgAccess & { role: 'owner' | 'admin' }> {
  const access = await getOrgAccess(db, userId, { id: organizationId });
  if (!access) throw new OrgError('not-found');
  if (!isOrgAdmin(access.role)) throw new OrgError('forbidden');
  return access as OrgAccess & { role: 'owner' | 'admin' };
}

async function examCountry(db: Db, countryCode: string): Promise<boolean> {
  const { rowCount } = await db.query(
    'select 1 from public.countries where iso_code = $1 and has_exam',
    [countryCode],
  );
  return (rowCount ?? 0) > 0;
}

/** Changes an organization's name, kind and colours. */
export async function updateOrganization(
  db: Db,
  actorId: string,
  organizationId: string,
  input: { name: string; kind: string; brandColor: string | null; brandAccent: string | null },
): Promise<void> {
  await requireOrgAdmin(db, actorId, organizationId);
  const name = input.name.trim().replace(/\s+/g, ' ');
  const color = input.brandColor?.trim().toLowerCase() || null;
  const accent = input.brandAccent?.trim().toLowerCase() || null;
  if (
    name.length < 1 ||
    name.length > 120 ||
    !isOrgKind(input.kind) ||
    (color !== null && !HEX_COLOR.test(color)) ||
    (accent !== null && !HEX_COLOR.test(accent))
  ) {
    throw new OrgError('invalid');
  }
  await db.query(
    `update public.organizations
     set name = $2, kind = $3, brand_color = $4, brand_accent = $5
     where id = $1`,
    [organizationId, name, input.kind, color, accent],
  );
}

// Logos ---------------------------------------------------------------------------

/** Stores an organization's logo. The file's own bytes decide what it is, not its name. */
export async function saveLogo(
  db: Db,
  actorId: string,
  organizationId: string,
  bytes: Uint8Array,
): Promise<string> {
  await requireOrgAdmin(db, actorId, organizationId);
  const contentType = logoType(bytes);
  if (!contentType || bytes.byteLength > MAX_LOGO_BYTES) throw new OrgError('bad-logo');
  const data = Buffer.from(bytes);
  const version = createHash('sha256').update(data).digest('hex').slice(0, 16);
  await db.query(
    `insert into public.org_logos (organization_id, content_type, byte_size, data, version)
     values ($1, $2, $3, $4, $5)
     on conflict (organization_id) do update set
       content_type = excluded.content_type, byte_size = excluded.byte_size,
       data = excluded.data, version = excluded.version, updated_at = now()`,
    [organizationId, contentType, data.byteLength, data, version],
  );
  return version;
}

export async function removeLogo(db: Db, actorId: string, organizationId: string): Promise<void> {
  await requireOrgAdmin(db, actorId, organizationId);
  await db.query('delete from public.org_logos where organization_id = $1', [organizationId]);
}

/** An organization's logo, for anyone: it is shown to people before they join. */
export async function getOrgLogo(
  db: Db,
  organizationId: string,
): Promise<{ contentType: LogoType; data: Buffer; version: string } | null> {
  if (!UUID.test(organizationId)) return null;
  const { rows } = await db.query<{ content_type: LogoType; data: Buffer; version: string }>(
    'select content_type, data, version from public.org_logos where organization_id = $1',
    [organizationId],
  );
  const row = rows[0];
  return row ? { contentType: row.content_type, data: row.data, version: row.version } : null;
}

// Seats ---------------------------------------------------------------------------

/** How many seats an organization has, and how they are taken up. */
export async function getSeats(
  db: Db,
  organizationId: string,
  granted: number,
  now: Date = new Date(),
): Promise<OrgSeats> {
  const subscriptions = (await teamSubscriptions(db, [organizationId])).get(organizationId) ?? [];
  const counts = await db.query<{ learners: number; pending: number }>(
    `select (select count(*)::int from public.org_members
             where organization_id = $1 and role = 'member') as learners,
            (select count(*)::int from public.org_invites
             where organization_id = $1 and role = 'member' and expires_at > $2) as pending`,
    [organizationId, now],
  );
  const stripe = subscriptions.find((subscription) => subscription.provider === 'stripe') ?? null;
  return {
    ...seatUsage({
      seats: seatsInForce(granted, subscriptions, now),
      learners: counts.rows[0]!.learners,
      pending: counts.rows[0]!.pending,
    }),
    granted,
    subscription: stripe && {
      seats: stripe.seats,
      status: stripe.status,
      currentPeriodEnd: stripe.currentPeriodEnd,
      cancelAtPeriodEnd: stripe.cancelAtPeriodEnd,
      inForce: isInForce(stripe, now),
    },
  };
}

// Invitations -----------------------------------------------------------------------

/** What became of a list of people to invite. */
export interface InviteOutcome {
  /** Invited, each with the token for their link. The token is not kept: this is the only copy. */
  invited: { email: string; name: string | null; token: string }[];
  /** Already in the organization. */
  alreadyMembers: string[];
  /** Left out because every seat is taken or held by an invitation. */
  noSeats: string[];
}

/**
 * Invites people to an organization. Inviting an address again replaces its
 * earlier invitation (the old link stops working). A learner's invitation
 * holds a seat until it is accepted, revoked or expires.
 */
export async function inviteLearners(
  pool: pg.Pool,
  actorId: string,
  organizationId: string,
  rows: readonly InviteRow[],
  options: { role?: 'member' | 'admin'; now?: Date } = {},
): Promise<InviteOutcome> {
  const now = options.now ?? new Date();
  const role = options.role ?? 'member';
  const access = await requireOrgAdmin(pool, actorId, organizationId);
  if (!canManageMember(access.role, role)) throw new OrgError('forbidden');

  const people: InviteRow[] = [];
  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (!email || (row.targetDate !== null && !isIsoDate(row.targetDate))) {
      throw new OrgError('invalid');
    }
    people.push({ ...row, email, name: row.name?.trim().slice(0, 120) || null });
  }
  for (const countryCode of new Set(people.map((person) => person.countryCode))) {
    if (countryCode !== null && !(await examCountry(pool, countryCode))) {
      throw new OrgError('invalid');
    }
  }

  return transaction(pool, async (client) => {
    // One list at a time per organization, so two admins cannot fill the same seat.
    await client.query('select 1 from public.organizations where id = $1 for update', [
      organizationId,
    ]);
    let available = (await getSeats(client, organizationId, access.granted, now)).available;
    const outcome: InviteOutcome = { invited: [], alreadyMembers: [], noSeats: [] };
    const expires = new Date(now.getTime() + INVITE_DAYS * 86_400_000);

    for (const person of people) {
      const member = await client.query(
        'select 1 from public.org_members where organization_id = $1 and email = $2',
        [organizationId, person.email],
      );
      if (member.rowCount) {
        outcome.alreadyMembers.push(person.email);
        continue;
      }
      const earlier = await client.query<{ role: OrgRole; live: boolean }>(
        `select role, expires_at > $3 as live from public.org_invites
         where organization_id = $1 and email = $2`,
        [organizationId, person.email, now],
      );
      // An invitation still out already holds its seat.
      const holdsSeat = earlier.rows[0]?.role === 'member' && earlier.rows[0].live;
      if (role === 'member' && !holdsSeat) {
        if (available <= 0) {
          outcome.noSeats.push(person.email);
          continue;
        }
        available -= 1;
      }
      const token = newToken();
      await client.query(
        `insert into public.org_invites
           (organization_id, email, name, role, country_code, target_date, token_hash,
            invited_by, created_at, expires_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (organization_id, email) do update set
           name = excluded.name, role = excluded.role, country_code = excluded.country_code,
           target_date = excluded.target_date, token_hash = excluded.token_hash,
           invited_by = excluded.invited_by, created_at = excluded.created_at,
           expires_at = excluded.expires_at`,
        [
          organizationId,
          person.email,
          person.name,
          role,
          role === 'member' ? person.countryCode : null,
          role === 'member' ? person.targetDate : null,
          tokenHash(token),
          actorId,
          now,
          expires,
        ],
      );
      outcome.invited.push({ email: person.email, name: person.name, token });
    }
    return outcome;
  });
}

interface InviteRecord {
  id: string;
  email: string;
  name: string | null;
  role: 'member' | 'admin';
  country_code: string | null;
  target_date: string | null;
  created_at: Date;
  expires_at: Date;
}

const INVITE_COLUMNS = `i.id, i.email, i.name, i.role, i.country_code,
       to_char(i.target_date, 'YYYY-MM-DD') as target_date, i.created_at, i.expires_at`;

const toInvite = (row: InviteRecord, now: Date): OrgInvite => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  countryCode: row.country_code,
  targetDate: row.target_date,
  createdAt: row.created_at.toISOString(),
  expiresAt: row.expires_at.toISOString(),
  expired: row.expires_at.getTime() <= now.getTime(),
});

/** An organization's invitations that have not been accepted, newest first. */
export async function listInvites(
  db: Db,
  actorId: string,
  organizationId: string,
  now: Date = new Date(),
): Promise<OrgInvite[]> {
  await requireOrgAdmin(db, actorId, organizationId);
  const { rows } = await db.query<InviteRecord>(
    `select ${INVITE_COLUMNS} from public.org_invites i
     where i.organization_id = $1
     order by i.created_at desc, i.email`,
    [organizationId],
  );
  return rows.map((row) => toInvite(row, now));
}

/** Withdraws an invitation: its link stops working and its seat is free again. */
export async function revokeInvite(
  db: Db,
  actorId: string,
  organizationId: string,
  inviteId: string,
): Promise<void> {
  await requireOrgAdmin(db, actorId, organizationId);
  if (!UUID.test(inviteId)) return;
  await db.query('delete from public.org_invites where id = $1 and organization_id = $2', [
    inviteId,
    organizationId,
  ]);
}

/** Sends an invitation again: a new link, good for another thirty days. */
export async function renewInvite(
  pool: pg.Pool,
  actorId: string,
  organizationId: string,
  inviteId: string,
  now: Date = new Date(),
): Promise<InviteOutcome> {
  await requireOrgAdmin(pool, actorId, organizationId);
  const { rows } = UUID.test(inviteId)
    ? await pool.query<InviteRecord>(
        `select ${INVITE_COLUMNS} from public.org_invites i
         where i.id = $1 and i.organization_id = $2`,
        [inviteId, organizationId],
      )
    : { rows: [] };
  const invite = rows[0];
  if (!invite) throw new OrgError('invite-gone');
  return inviteLearners(
    pool,
    actorId,
    organizationId,
    [
      {
        email: invite.email,
        name: invite.name,
        countryCode: invite.country_code,
        targetDate: invite.target_date,
      },
    ],
    { role: invite.role, now },
  );
}

/** An invitation as the person invited sees it. */
export interface InviteView extends OrgInvite {
  organization: Organization;
  countryName: string | null;
}

// Invitation and organization both have an id and a name: the invitation's are renamed.
const INVITE_VIEW = `select ${INVITE_COLUMNS}, ${ORG_COLUMNS},
            i.id as invite_id, i.name as invite_name, c.name as country_name
     from public.org_invites i
     join public.organizations o on o.id = i.organization_id
     left join public.countries c on c.iso_code = i.country_code`;

type InviteViewRow = InviteRecord &
  OrgRow & { invite_id: string; invite_name: string | null; country_name: string | null };

const toInviteView = (row: InviteViewRow, now: Date): InviteView => ({
  ...toInvite({ ...row, id: row.invite_id, name: row.invite_name }, now),
  organization: toOrganization(row),
  countryName: row.country_name,
});

/** The invitation a link's token opens, or null if there is none (any more). */
export async function findInvite(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<InviteView | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const { rows } = await db.query<InviteViewRow>(`${INVITE_VIEW} where i.token_hash = $1`, [
    tokenHash(token),
  ]);
  return rows[0] ? toInviteView(rows[0], now) : null;
}

/**
 * Invitations waiting for the address someone signed in with. Only call this
 * with an address the sign-in provider has verified.
 */
export async function pendingInvitesFor(
  db: Db,
  email: string | null,
  now: Date = new Date(),
): Promise<InviteView[]> {
  const address = email ? normalizeEmail(email) : null;
  if (!address) return [];
  const { rows } = await db.query<InviteViewRow>(
    `${INVITE_VIEW} where i.email = $1 and i.expires_at > $2 order by i.created_at`,
    [address, now],
  );
  return rows.map((row) => toInviteView(row, now));
}

/** Puts a country an organization assigned on a learner's own study plan, as the one the app opens on. */
async function applyAssignment(
  db: Db,
  userId: string,
  countryCode: string,
  targetDate: string | null,
): Promise<boolean> {
  // Someone who has not set Oathly up yet does that first, with the country
  // filled in for them; there is no plan to add it to.
  const settings = await db.query(
    'select 1 from public.user_settings where user_id = $1 and onboarded_at is not null',
    [userId],
  );
  if (!settings.rowCount) return false;
  await db.query(
    `update public.user_countries set is_primary = false
     where user_id = $1 and is_primary and country_code <> $2`,
    [userId, countryCode],
  );
  await db.query(
    `insert into public.user_countries (user_id, country_code, exam_date, is_primary)
     values ($1, $2, $3, true)
     on conflict (user_id, country_code) do update set
       exam_date = coalesce(excluded.exam_date, public.user_countries.exam_date),
       is_primary = true`,
    [userId, countryCode, targetDate],
  );
  return true;
}

/** What accepting an invitation came to. */
export interface JoinResult {
  organization: Organization;
  role: OrgRole;
  countryCode: string | null;
  targetDate: string | null;
  /** False when the learner has yet to set Oathly up: send them to do that, country in hand. */
  onStudyPlan: boolean;
}

/**
 * Accepts an invitation. The link's token is enough; without it (accepting
 * from the dashboard), the invitation must have been sent to the verified
 * address the person signed in with.
 */
export async function acceptInvite(
  pool: pg.Pool,
  user: { userId: string; email: string | null },
  by: { token: string } | { inviteId: string },
  now: Date = new Date(),
): Promise<JoinResult> {
  if ('inviteId' in by && !UUID.test(by.inviteId)) throw new OrgError('invite-gone');
  return transaction(pool, async (client) => {
    const { rows } = await client.query<InviteViewRow>(
      `${INVITE_VIEW} where ${'token' in by ? 'i.token_hash = $1' : 'i.id = $1'} for update of i`,
      ['token' in by ? tokenHash(by.token) : by.inviteId],
    );
    const row = rows[0];
    if (!row || row.expires_at.getTime() <= now.getTime()) throw new OrgError('invite-gone');
    if ('inviteId' in by && normalizeEmail(user.email ?? '') !== row.email) {
      throw new OrgError('wrong-address');
    }
    const invite = toInviteView(row, now);
    const organizationId = invite.organization.id;

    const existing = await client.query<{ role: OrgRole }>(
      'select role from public.org_members where organization_id = $1 and user_id = $2',
      [organizationId, user.userId],
    );
    const role = existing.rows[0]?.role ?? invite.role;
    if (!existing.rows[0]) {
      const inviter = await client.query<{ invited_by: string | null }>(
        'select invited_by from public.org_invites where id = $1',
        [invite.id],
      );
      await client.query(
        `insert into public.org_members
           (organization_id, user_id, role, invited_by, email, name, country_code, target_date)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          organizationId,
          user.userId,
          invite.role,
          inviter.rows[0]!.invited_by,
          invite.email,
          invite.name,
          invite.countryCode,
          invite.targetDate,
        ],
      );
    }
    await client.query('delete from public.org_invites where id = $1', [invite.id]);

    const assigned = role === 'member' && !existing.rows[0] ? invite.countryCode : null;
    return {
      organization: invite.organization,
      role,
      countryCode: assigned,
      targetDate: assigned ? invite.targetDate : null,
      onStudyPlan: assigned
        ? await applyAssignment(client, user.userId, assigned, invite.targetDate)
        : true,
    };
  });
}

// Members ---------------------------------------------------------------------------

/** The people who run an organization. */
export async function listStaff(
  db: Db,
  actorId: string,
  organizationId: string,
): Promise<OrgStaff[]> {
  await requireOrgAdmin(db, actorId, organizationId);
  const { rows } = await db.query<{
    user_id: string;
    name: string | null;
    email: string | null;
    role: 'owner' | 'admin';
  }>(
    `select m.user_id, coalesce(m.name, p.display_name) as name, m.email, m.role
     from public.org_members m
     join public.profiles p on p.id = m.user_id
     where m.organization_id = $1 and m.role in ('owner', 'admin')
     order by (m.role = 'owner') desc, m.created_at`,
    [organizationId],
  );
  return rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
  }));
}

async function memberRole(db: Db, organizationId: string, userId: string): Promise<OrgRole | null> {
  const { rows } = await db.query<{ role: OrgRole }>(
    'select role from public.org_members where organization_id = $1 and user_id = $2',
    [organizationId, userId],
  );
  return rows[0]?.role ?? null;
}

/** Changes what a learner has been asked to prepare for, and by when. */
export async function assignLearner(
  pool: pg.Pool,
  actorId: string,
  organizationId: string,
  learnerId: string,
  input: { countryCode: string | null; targetDate: string | null },
): Promise<void> {
  const access = await requireOrgAdmin(pool, actorId, organizationId);
  const role = await memberRole(pool, organizationId, learnerId);
  if (role === null) throw new OrgError('not-found');
  if (role !== 'member' || !canManageMember(access.role, role)) throw new OrgError('forbidden');
  if (
    (input.targetDate !== null && !isIsoDate(input.targetDate)) ||
    (input.countryCode !== null && !(await examCountry(pool, input.countryCode)))
  ) {
    throw new OrgError('invalid');
  }
  await transaction(pool, async (client) => {
    await client.query(
      `update public.org_members set country_code = $3, target_date = $4
       where organization_id = $1 and user_id = $2`,
      [organizationId, learnerId, input.countryCode, input.targetDate],
    );
    if (input.countryCode) {
      await applyAssignment(client, learnerId, input.countryCode, input.targetDate);
    }
  });
}

/** Removes someone from an organization. Their own study history stays theirs. */
export async function removeMember(
  db: Db,
  actorId: string,
  organizationId: string,
  memberId: string,
): Promise<void> {
  const access = await requireOrgAdmin(db, actorId, organizationId);
  const role = await memberRole(db, organizationId, memberId);
  if (role === null) return;
  if (!canManageMember(access.role, role)) throw new OrgError('forbidden');
  await db.query('delete from public.org_members where organization_id = $1 and user_id = $2', [
    organizationId,
    memberId,
  ]);
}

/** Leaves an organization: its admins stop seeing the learner from that moment. */
export async function leaveOrganization(
  db: Db,
  userId: string,
  organizationId: string,
): Promise<void> {
  if (!UUID.test(organizationId)) return;
  // The owner cannot walk away from the organization they are responsible for.
  await db.query(
    `delete from public.org_members
     where organization_id = $1 and user_id = $2 and role <> 'owner'`,
    [organizationId, userId],
  );
}

// The report -----------------------------------------------------------------------

/** How many learners' histories are read from the database at a time. */
const REPORT_BATCH = 50;

interface LearnerRow {
  user_id: string;
  name: string | null;
  email: string | null;
  created_at: Date;
  country_code: string | null;
  country_name: string | null;
  target_date: string | null;
}

/**
 * Each learner's readiness and activity, for the organization's admins.
 * Readiness is for the country the organization assigned (or, if it assigned
 * none, the one the learner's app opens on), measured the way the learner's
 * own dashboard measures it. Nothing about any other country, and no
 * individual answers, leave this function.
 */
export async function getOrgReport(
  db: Db,
  actorId: string,
  organizationId: string,
  now: Date = new Date(),
): Promise<OrgReport> {
  const access = await requireOrgAdmin(db, actorId, organizationId);
  const members = await db.query<LearnerRow>(
    `select m.user_id, coalesce(m.name, p.display_name) as name, m.email, m.created_at,
            c.iso_code as country_code, c.name as country_name,
            to_char(coalesce(m.target_date, uc.exam_date), 'YYYY-MM-DD') as target_date
     from public.org_members m
     join public.profiles p on p.id = m.user_id
     left join lateral (
       select u.country_code, u.exam_date
       from public.user_countries u
       where u.user_id = m.user_id
         and (m.country_code is null or u.country_code = m.country_code)
       order by u.is_primary desc, u.created_at
       limit 1
     ) uc on true
     left join public.countries c on c.iso_code = coalesce(m.country_code, uc.country_code)
     where m.organization_id = $1 and m.role = 'member'
     order by m.created_at, m.user_id`,
    [organizationId],
  );

  const subscriptions = (await teamSubscriptions(db, [organizationId])).get(organizationId) ?? [];
  const content = new Map<string, { bank: QuizQuestion[]; formats: CountryExamFormat[] }>();
  const contentFor = async (countryCode: string) => {
    let loaded = content.get(countryCode);
    if (!loaded) {
      loaded = {
        bank: await loadQuestionPool(db, countryCode),
        formats: await loadExamFormats(db, countryCode),
      };
      content.set(countryCode, loaded);
    }
    return loaded;
  };

  const learners: OrgLearner[] = [];
  for (let start = 0; start < members.rows.length; start += REPORT_BATCH) {
    const batch = members.rows.slice(start, start + REPORT_BATCH);
    const ids = batch.map((member) => member.user_id);
    const [held, answers, mocks] = await Promise.all([
      entitlementsFor(db, ids),
      db.query<{
        user_id: string;
        question_id: string;
        correct: boolean;
        time_ms: number;
        created_at: Date;
        country_code: string;
      }>(
        `select e.user_id, e.question_id, e.correct, e.time_ms, e.created_at, q.country_code
         from public.answer_events e
         join public.questions q on q.id = e.question_id
         where e.user_id = any($1)
         order by e.created_at`,
        [ids],
      ),
      db.query<MockRow & { user_id: string; country_code: string }>(
        `select m.user_id, f.country_code, m.exam_format_id, m.submitted_at, m.correct_count,
                cardinality(m.question_ids) as total
         from public.mock_exams m
         join public.exam_formats f on f.id = m.exam_format_id
         where m.user_id = any($1) and m.submitted_at is not null and m.correct_count is not null
         order by m.submitted_at desc`,
        [ids],
      ),
    ]);

    for (const [offset, member] of batch.entries()) {
      const countryCode = member.country_code;
      const history: AnswerEvent[] = answers.rows
        .filter((row) => row.user_id === member.user_id && row.country_code === countryCode)
        .map((row) => ({
          questionId: row.question_id,
          correct: row.correct,
          timeMs: row.time_ms,
          answeredAt: row.created_at,
        }));
      const sat = mocks.rows.filter(
        (row) => row.user_id === member.user_id && row.country_code === countryCode,
      );

      let measured: ReturnType<typeof measureReadiness> = null;
      if (countryCode) {
        const { bank, formats } = await contentFor(countryCode);
        // The questions this learner can study: all of them on a seat, the sample otherwise.
        const pool = accessibleQuestions(
          { entitlements: held.get(member.user_id)! },
          countryCode,
          bank,
          now,
        );
        const inPool = new Set(pool.map((question) => question.id));
        measured = measureReadiness(
          pool,
          history.filter((event) => inPool.has(event.questionId)),
          formats,
          sat,
          now,
        );
      }

      const activity = learnerActivity(history, now);
      const daysLeft = daysUntilExam({ examDate: member.target_date }, now);
      const readiness = measured?.estimate.score ?? null;
      const questionsSeen = measured?.estimate.questionsSeen ?? 0;
      const seat = seatSource(start + offset, access.granted, subscriptions);
      learners.push({
        userId: member.user_id,
        name: member.name,
        email: member.email,
        countryCode,
        countryName: member.country_name,
        targetDate: member.target_date,
        daysLeft,
        joinedAt: member.created_at.toISOString(),
        hasSeat: seat === 'granted' || (seat !== null && isInForce(seat, now)),
        readiness,
        isEarlyEstimate: measured?.estimate.isEarlyEstimate ?? true,
        questionsSeen,
        lastActiveAt: activity.lastActiveAt?.toISOString() ?? null,
        answersThisWeek: activity.answersThisWeek,
        minutesThisWeek: activity.minutesThisWeek,
        answers: activity.answers,
        mockExams: sat.length,
        lastMockPercent: sat[0] ? Math.round((sat[0].correct_count / sat[0].total) * 100) : null,
        activity: activityLevel(activity.lastActiveAt, now),
        standing: learnerStanding(
          { score: readiness, questionsSeen, daysLeft, lastActiveAt: activity.lastActiveAt },
          now,
        ),
      });
    }
  }

  return {
    organization: access.organization,
    generatedAt: now.toISOString(),
    summary: summarizeLearners(
      learners.map((learner) => ({
        standing: learner.standing,
        activity: learner.activity,
        score: learner.readiness,
      })),
    ),
    learners,
  };
}
