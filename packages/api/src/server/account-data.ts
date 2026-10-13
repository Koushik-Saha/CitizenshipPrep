import type pg from 'pg';

// What a learner can do with their own account's data besides deleting it:
// change the name they go by, say whether their use is counted, and take a
// copy of everything held about them.

type Db = Pick<pg.Pool, 'query'>;

/** Sets the name a learner goes by; null shows none. The caller has checked it (parseDisplayName). */
export async function updateDisplayName(
  db: Db,
  userId: string,
  name: string | null,
): Promise<void> {
  await db.query('update public.profiles set display_name = $2 where id = $1', [userId, name]);
}

/** Records whether a learner wants their use left out of product statistics. */
export async function setAnalyticsOptOut(db: Db, userId: string, optOut: boolean): Promise<void> {
  await db.query(
    `insert into public.user_settings (user_id, analytics_opt_out) values ($1, $2)
     on conflict (user_id) do update set analytics_opt_out = excluded.analytics_opt_out`,
    [userId, optOut],
  );
}

/** Whether a learner has asked for their use not to be counted. */
export async function hasOptedOutOfAnalytics(db: Db, userId: string): Promise<boolean> {
  const { rows } = await db.query<{ analytics_opt_out: boolean }>(
    'select analytics_opt_out from public.user_settings where user_id = $1',
    [userId],
  );
  return rows[0]?.analytics_opt_out ?? false;
}

/**
 * Every table that holds rows about a learner: the column that names them,
 * how to order the rows, and any columns left out because they are about
 * someone else (the member of staff who dealt with a report, say).
 */
const TABLES: { name: string; owner: string; order: string; omit?: string[] }[] = [
  { name: 'user_settings', owner: 'user_id', order: 'created_at' },
  { name: 'user_countries', owner: 'user_id', order: 'created_at' },
  { name: 'attempts', owner: 'user_id', order: 'started_at' },
  { name: 'answer_events', owner: 'user_id', order: 'id' },
  { name: 'mastery', owner: 'user_id', order: 'topic_id' },
  { name: 'mock_exams', owner: 'user_id', order: 'started_at' },
  { name: 'subscriptions', owner: 'user_id', order: 'created_at' },
  { name: 'billing_customers', owner: 'user_id', order: 'created_at' },
  { name: 'ai_usage', owner: 'user_id', order: 'id' },
  { name: 'content_flags', owner: 'user_id', order: 'created_at', omit: ['resolved_by'] },
  { name: 'community_posts', owner: 'author_id', order: 'created_at' },
  { name: 'community_comments', owner: 'author_id', order: 'created_at' },
  { name: 'community_votes', owner: 'user_id', order: 'created_at' },
  { name: 'community_reports', owner: 'reporter_id', order: 'created_at', omit: ['resolved_by'] },
  { name: 'org_members', owner: 'user_id', order: 'created_at', omit: ['invited_by'] },
];

/** The tables a copy is made from, by name: for checking none has been missed. */
export const exportedTables = TABLES.map((table) => table.name);

/** The most rows of one table a copy holds. A learner who has answered more is told so. */
export const EXPORT_ROW_LIMIT = 50_000;

export interface AccountExport {
  /** When the copy was made. */
  exportedAt: string;
  account: { id: string; displayName: string | null; createdAt: string };
  /** Each table's rows, as stored, without the column that only repeats the account's id. */
  data: Record<string, Record<string, unknown>[]>;
  /** Tables that had more rows than a copy holds. */
  truncated: string[];
}

/**
 * Everything held about one learner, as one object to hand them: the right
 * to a portable copy. Only rows that are theirs, found by their id; a table
 * that does not exist in this database, or does not have the expected column,
 * is left out rather than failing the copy. Null when there is no such account.
 */
export async function exportAccountData(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<AccountExport | null> {
  const profile = await db.query<{ id: string; display_name: string | null; created_at: Date }>(
    'select id, display_name, created_at from public.profiles where id = $1',
    [userId],
  );
  const account = profile.rows[0];
  if (!account) return null;

  const present = await db.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
  );
  const columns = new Set(present.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const data: AccountExport['data'] = {};
  const truncated: string[] = [];
  for (const table of TABLES) {
    if (
      !columns.has(`${table.name}.${table.owner}`) ||
      !columns.has(`${table.name}.${table.order}`)
    ) {
      continue;
    }
    // The names come from the list above, never from a request.
    const { rows } = await db.query<{ row: Record<string, unknown> }>(
      `select to_jsonb(t) - $2::text[] as row from public.${table.name} t
       where t.${table.owner} = $1 order by t.${table.order} limit $3`,
      [userId, [table.owner, ...(table.omit ?? [])], EXPORT_ROW_LIMIT + 1],
    );
    if (rows.length > EXPORT_ROW_LIMIT) truncated.push(table.name);
    data[table.name] = rows.slice(0, EXPORT_ROW_LIMIT).map((entry) => entry.row);
  }
  return {
    exportedAt: now.toISOString(),
    account: {
      id: account.id,
      displayName: account.display_name,
      createdAt: account.created_at.toISOString(),
    },
    data,
    truncated,
  };
}
