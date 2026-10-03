import { createPool } from '@oathly/content/db';

type Pool = ReturnType<typeof createPool>;

// One pool per server process, surviving hot reloads in development. It
// connects as the database owner: server code only, and every query that
// touches a learner's data must be scoped to a verified user id.
const globalForDb = globalThis as typeof globalThis & { oathlyPool?: Pool };

export function getDb(): Pool {
  globalForDb.oathlyPool ??= createPool();
  return globalForDb.oathlyPool;
}
