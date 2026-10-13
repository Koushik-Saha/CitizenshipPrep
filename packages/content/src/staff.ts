import type { Db } from './db';

// Who is staff: granting and taking away the roles that let an account into
// the reviewers' area (/admin). Run from the content CLI by whoever holds the
// database: there is deliberately no screen for it, so getting into the
// admin area is never enough to make another admin.

export type StaffRole = 'reviewer' | 'admin';

export class StaffError extends Error {}

export interface StaffAccount {
  userId: string;
  email: string | null;
}

/**
 * The account to act on: by its id, or by the email address it signs in
 * with. An address has to be verified, so a role cannot be given to whoever
 * signs up with someone else's.
 */
export async function findAccount(
  db: Db,
  who: { userId?: string; email?: string },
): Promise<StaffAccount> {
  if (who.userId) return { userId: who.userId, email: null };
  const email = who.email?.trim().toLowerCase();
  if (!email) throw new StaffError('Say who: --email or --user.');
  const table = await db.query<{ present: boolean }>(
    `select to_regclass('neon_auth."user"') is not null as present`,
  );
  if (!table.rows[0]!.present) {
    throw new StaffError('This database has no sign-in accounts to look up: use --user <id>.');
  }
  const { rows } = await db.query<{ id: string; email: string; verified: boolean }>(
    `select id::text, email, "emailVerified" as verified from neon_auth."user"
     where lower(email) = $1`,
    [email],
  );
  if (rows.length === 0) {
    throw new StaffError(
      `Nobody has signed up with ${email}. Sign in on the site with it once, then run this again.`,
    );
  }
  if (!rows[0]!.verified) {
    throw new StaffError(`${email} has not been verified yet. Sign in with it once first.`);
  }
  return { userId: rows[0]!.id, email: rows[0]!.email };
}

/** Gives an account a staff role (or changes the one it has). */
export async function grantStaffRole(db: Db, userId: string, role: StaffRole): Promise<void> {
  if (role !== 'admin' && role !== 'reviewer') {
    throw new StaffError('--role must be admin or reviewer.');
  }
  // The account may never have opened the app: its profile is made on first sight.
  await db.query('insert into public.profiles (id) values ($1) on conflict (id) do nothing', [
    userId,
  ]);
  await db.query(
    `insert into public.user_roles (user_id, role) values ($1, $2)
     on conflict (user_id) do update set role = excluded.role`,
    [userId, role],
  );
}

/**
 * Takes an account's staff role away, and its authenticator with it. Returns
 * whether it held one. Their open session stops working at once: every page
 * checks the role.
 */
export async function revokeStaffRole(db: Db, userId: string): Promise<boolean> {
  await db.query('delete from public.staff_second_factors where user_id = $1', [userId]);
  const removed = await db.query('delete from public.user_roles where user_id = $1', [userId]);
  return (removed.rowCount ?? 0) > 0;
}

/**
 * Forgets a staff member's authenticator (a lost phone). They set a new one
 * up the next time they sign in. Returns whether there was one.
 */
export async function resetSecondFactor(db: Db, userId: string): Promise<boolean> {
  const removed = await db.query('delete from public.staff_second_factors where user_id = $1', [
    userId,
  ]);
  return (removed.rowCount ?? 0) > 0;
}

export interface StaffMember {
  userId: string;
  role: StaffRole;
  displayName: string | null;
  /** Whether they have an authenticator: none, being set up, or in use. */
  secondFactor: 'none' | 'pending' | 'confirmed';
  grantedAt: string;
}

/** Everyone who holds a staff role, admins first. */
export async function listStaff(db: Db): Promise<StaffMember[]> {
  const { rows } = await db.query<{
    user_id: string;
    role: StaffRole;
    display_name: string | null;
    second_factor: StaffMember['secondFactor'];
    granted_at: Date;
  }>(
    `select r.user_id, r.role, p.display_name, r.granted_at,
            case when f.user_id is null then 'none'
                 when f.confirmed_at is null then 'pending'
                 else 'confirmed' end as second_factor
     from public.user_roles r
     join public.profiles p on p.id = r.user_id
     left join public.staff_second_factors f on f.user_id = r.user_id
     order by r.role = 'admin' desc, r.granted_at`,
  );
  return rows.map((row) => ({
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name,
    secondFactor: row.second_factor,
    grantedAt: row.granted_at.toISOString(),
  }));
}
