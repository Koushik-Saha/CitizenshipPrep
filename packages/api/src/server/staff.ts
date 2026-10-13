import type pg from 'pg';

import { matchTotp, newTotpSecret, openSecret, sealSecret } from './totp';

// Who may enter the reviewers' area, the second factor they enter it with,
// and the record of what they do there.

type Db = Pick<pg.Pool, 'query'>;

export type StaffRole = 'reviewer' | 'admin';

/** The staff role a user holds, or null: most people hold none. */
export async function staffRole(db: Db, userId: string): Promise<StaffRole | null> {
  const { rows } = await db.query<{ role: StaffRole }>(
    'select role from public.user_roles where user_id = $1',
    [userId],
  );
  return rows[0]?.role ?? null;
}

export interface StaffMember {
  role: StaffRole;
  /** The name their profile gives them. */
  displayName: string | null;
  /** They have an authenticator, and its first code has been accepted. */
  secondFactorInUse: boolean;
  /** Sessions that began before this are over: they signed out then. */
  sessionsFrom: Date | null;
}

/** A staff member as the admin area needs to know them, or null for everyone else. */
export async function staffMember(db: Db, userId: string): Promise<StaffMember | null> {
  const { rows } = await db.query<{
    role: StaffRole;
    display_name: string | null;
    in_use: boolean;
    sessions_from: Date | null;
  }>(
    `select r.role, p.display_name, f.confirmed_at is not null as in_use, f.sessions_from
     from public.user_roles r
     join public.profiles p on p.id = r.user_id
     left join public.staff_second_factors f on f.user_id = r.user_id
     where r.user_id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    role: row.role,
    displayName: row.display_name,
    secondFactorInUse: row.in_use,
    sessionsFrom: row.sessions_from,
  };
}

/**
 * Ends every session a staff member has open, on every device: what signing
 * out does. A copy of their session cookie stops working with the original.
 */
export async function endStaffSessions(db: Db, userId: string, now: Date = new Date()) {
  await db.query('update public.staff_second_factors set sessions_from = $2 where user_id = $1', [
    userId,
    now,
  ]);
}

/** Whether a staff member has an authenticator: none, one being set up, or one in use. */
export type SecondFactorState = 'none' | 'pending' | 'confirmed';

export async function secondFactorState(db: Db, userId: string): Promise<SecondFactorState> {
  const { rows } = await db.query<{ confirmed: boolean }>(
    'select confirmed_at is not null as confirmed from public.staff_second_factors where user_id = $1',
    [userId],
  );
  if (!rows[0]) return 'none';
  return rows[0].confirmed ? 'confirmed' : 'pending';
}

/**
 * The secret to put into an authenticator app, for someone who has none in
 * use. Asking again before the first code is accepted gives the same secret,
 * so reloading the page does not undo what was typed into the phone. Null
 * once an authenticator is in use: it is never shown again.
 */
export async function startEnrollment(db: Db, key: Buffer, userId: string): Promise<string | null> {
  const existing = await db.query<{ secret_sealed: string; confirmed: boolean }>(
    `select secret_sealed, confirmed_at is not null as confirmed
     from public.staff_second_factors where user_id = $1`,
    [userId],
  );
  const row = existing.rows[0];
  if (row?.confirmed) return null;
  const kept = row ? openSecret(key, row.secret_sealed) : null;
  if (kept) return kept;

  // None yet, or one sealed with a key the server no longer holds.
  const secret = newTotpSecret();
  await db.query(
    `insert into public.staff_second_factors (user_id, secret_sealed) values ($1, $2)
     on conflict (user_id) do update set secret_sealed = excluded.secret_sealed, last_step = null
     where public.staff_second_factors.confirmed_at is null`,
    [userId, sealSecret(key, secret)],
  );
  return secret;
}

/**
 * Checks a typed code against the staff member's authenticator. With
 * `confirming`, a first accepted code puts the authenticator into use;
 * without it, only one already in use counts. An accepted code is spent: the
 * same code, or an earlier one, is refused afterwards, even when two requests
 * arrive together.
 */
export async function acceptSecondFactor(
  db: Db,
  key: Buffer,
  userId: string,
  code: string,
  options: { confirming?: boolean; now?: Date } = {},
): Promise<boolean> {
  const now = options.now ?? new Date();
  const { rows } = await db.query<{
    secret_sealed: string;
    confirmed: boolean;
    last_step: string | null;
  }>(
    `select secret_sealed, confirmed_at is not null as confirmed, last_step
     from public.staff_second_factors where user_id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row || row.confirmed === Boolean(options.confirming)) return false;
  const secret = openSecret(key, row.secret_sealed);
  if (!secret) return false;
  const step = matchTotp(secret, code, now, row.last_step === null ? null : Number(row.last_step));
  if (step === null) return false;
  // The step only ever moves forward, so of two requests with one code, one wins.
  const spent = await db.query(
    `update public.staff_second_factors
     set last_step = $2, confirmed_at = coalesce(confirmed_at, $3)
     where user_id = $1 and (last_step is null or last_step < $2)`,
    [userId, step, now],
  );
  return (spent.rowCount ?? 0) > 0;
}

/**
 * Whether any admin has an authenticator in use. Until one does, nobody could
 * get in to set the first one up, so the shared account that came before is
 * still let in; from then on it never is.
 */
export async function hasEnrolledAdmin(db: Db): Promise<boolean> {
  const { rowCount } = await db.query(
    `select 1 from public.user_roles r
     join public.staff_second_factors f on f.user_id = r.user_id
     where r.role = 'admin' and f.confirmed_at is not null
     limit 1`,
  );
  return (rowCount ?? 0) > 0;
}

// --- The record ----------------------------------------------------------------

export interface AdminAction {
  /** Who did it. */
  actorId: string;
  actorName?: string | null;
  /** What they did, as "thing.verb": "question.approve", "sign-in.refused". */
  action: string;
  /** What it was done to. */
  targetType?: string | null;
  targetId?: string | null;
  /** Anything else worth keeping: a count, a reason. Never a secret or a code. */
  detail?: Record<string, unknown>;
}

/** Writes one line of the record. The table accepts additions and nothing else. */
export async function recordAdminAction(db: Db, entry: AdminAction): Promise<void> {
  await db.query(
    `insert into public.admin_audit_log (actor_id, actor_name, action, target_type, target_id, detail)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      entry.actorId.slice(0, 200),
      entry.actorName?.slice(0, 200) ?? null,
      entry.action.slice(0, 80),
      entry.targetType?.slice(0, 40) ?? null,
      entry.targetId?.slice(0, 200) ?? null,
      JSON.stringify(entry.detail ?? {}),
    ],
  );
}

export interface AdminActionRecord {
  id: string;
  actorId: string;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown>;
  at: string;
}

/** How many lines of the record one page shows. */
export const AUDIT_PAGE_SIZE = 50;

/**
 * The record, newest first, a page at a time. `before` is the id of the last
 * line of the page before; `actorId` and `action` narrow it (the action by
 * its beginning: "question." is every question decision).
 */
export async function listAdminActions(
  db: Db,
  filters: { before?: string | null; actorId?: string | null; action?: string | null } = {},
  limit = AUDIT_PAGE_SIZE,
): Promise<AdminActionRecord[]> {
  const before = filters.before && /^\d{1,18}$/.test(filters.before) ? filters.before : null;
  const { rows } = await db.query<{
    id: string;
    actor_id: string;
    actor_name: string | null;
    action: string;
    target_type: string | null;
    target_id: string | null;
    detail: Record<string, unknown>;
    created_at: Date;
  }>(
    `select id, actor_id, actor_name, action, target_type, target_id, detail, created_at
     from public.admin_audit_log
     where ($1::bigint is null or id < $1)
       and ($2::text is null or actor_id = $2)
       and ($3::text is null or starts_with(action, $3))
     order by id desc
     limit $4`,
    [before, filters.actorId || null, filters.action || null, Math.min(Math.max(limit, 1), 200)],
  );
  return rows.map((row) => ({
    id: String(row.id),
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    detail: row.detail,
    at: row.created_at.toISOString(),
  }));
}
