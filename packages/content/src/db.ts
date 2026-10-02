import pg from 'pg';

/** A pool, or a client checked out for a transaction: anything that can run a query. */
export type Db = Pick<pg.Pool, 'query'>;

/**
 * Connects as the database owner, which is not subject to Row Level Security.
 * Server-side only: this connection string must never reach a browser or app.
 */
export function createPool(connectionString = process.env.DATABASE_URL): pg.Pool {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local at the repository root.');
  }
  return new pg.Pool({ connectionString, max: 5 });
}

/** Runs `work` in one transaction: commits if it returns, rolls back if it throws. */
export async function withTransaction<T>(
  pool: pg.Pool,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
