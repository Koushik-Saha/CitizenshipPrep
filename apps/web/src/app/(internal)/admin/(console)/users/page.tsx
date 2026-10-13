import { ADMIN_USERS_PAGE_SIZE, searchUsers } from '@oathly/api/server';
import type { Metadata } from 'next';

import { DataTable, td, UserLink, When } from '@/components/admin/console';
import { Badge, fieldClass, labelClass, Notice } from '@/components/ui';
import { getDb, requireAdmin } from '@/lib/admin';

export const metadata: Metadata = { title: 'Users' };

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Everyone with an account, newest first, or those a search finds. Admins only.
export default async function Users({ searchParams }: PageProps<'/admin/users'>) {
  await requireAdmin();
  const params = await searchParams;
  const search = single(params.q)?.trim() ?? '';
  const users = await searchUsers(getDb(), search);

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Users</h1>
      <p className="text-fg-muted mt-1 max-w-3xl">
        Find an account by its id, or by part of a name or an email address. Opening an account is
        recorded.
      </p>
      {single(params.deleted) && (
        <div className="mt-4">
          <Notice tone="success" role="status">
            The account and its data have been deleted.
            {single(params.deleted) === 'data'
              ? ' Its sign-in record could not be removed from here: remove it in the Neon console, under Auth.'
              : ''}
          </Notice>
        </div>
      )}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className={labelClass}>
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={search}
            className={`${fieldClass} w-80 max-w-full`}
          />
        </div>
        <button
          type="submit"
          className="border-border-strong hover:bg-surface-sunken focus-visible:outline-focus-ring rounded-md border px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Search
        </button>
      </form>

      {users.length === 0 ? (
        <p className="text-fg-muted mt-8">{search ? 'Nobody matches that.' : 'No accounts yet.'}</p>
      ) : (
        <DataTable
          caption="Accounts"
          head={['Account', 'Email', 'Joined', 'Studies', 'Plan', 'Last active']}
        >
          {users.map((user) => (
            <tr key={user.id} className="border-border border-b" data-testid="user-row">
              <td className={td}>
                <UserLink id={user.id} name={user.displayName} />
                {user.staffRole && (
                  <span className="ms-2">
                    <Badge tone="warning">{user.staffRole}</Badge>
                  </span>
                )}
                <div className="text-fg-muted font-mono text-xs">{user.id}</div>
              </td>
              <td className={td}>{user.email ?? <span className="text-fg-muted">—</span>}</td>
              <td className={td}>
                <When at={user.joinedAt} date />
              </td>
              <td className={td}>
                {user.countries.join(', ') || <span className="text-fg-muted">—</span>}
              </td>
              <td className={td}>
                {[
                  user.pro ? 'Pro' : null,
                  user.passes > 0
                    ? `${user.passes} Country Pass${user.passes > 1 ? 'es' : ''}`
                    : null,
                  user.seats > 0 ? 'Organization seat' : null,
                ]
                  .filter(Boolean)
                  .join(', ') || 'Free'}
              </td>
              <td className={td}>
                <When at={user.lastActiveAt} />
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      {users.length === ADMIN_USERS_PAGE_SIZE && (
        <p className="text-fg-muted mt-4 text-sm">
          Showing the newest {ADMIN_USERS_PAGE_SIZE}. Search to find anyone else.
        </p>
      )}
    </>
  );
}
