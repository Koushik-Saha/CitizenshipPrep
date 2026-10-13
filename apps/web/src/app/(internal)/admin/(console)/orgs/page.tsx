import { stripeDashboardUrl } from '@oathly/api/billing';
import { listOrganizationsForAdmin } from '@oathly/api/server';
import { capStatus } from '@oathly/core';
import type { Metadata } from 'next';

import { DataTable, StripeLink, td, When } from '@/components/admin/console';
import { Badge } from '@/components/ui';
import { getDb, requireAdmin } from '@/lib/admin';
import { isStripeLive } from '@/lib/billing';

export const metadata: Metadata = { title: 'Organizations' };

// Every organization, with the seats it has and how many are filled. Admins
// only. Nothing on this page changes anything: an organization's own admins
// manage its members, and its seats are changed in Stripe.
export default async function Organizations() {
  await requireAdmin();
  const organizations = await listOrganizationsForAdmin(getDb());
  const live = isStripeLive();

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Organizations</h1>
      <p className="text-fg-muted mt-1 max-w-3xl">
        Schools, firms and nonprofits, newest first. Seats are what an organization pays for, or
        what staff have granted it; a learner who joins takes one.
      </p>
      {organizations.length === 0 ? (
        <p className="text-fg-muted mt-8">No organizations yet.</p>
      ) : (
        <DataTable
          caption="Organizations and their seats"
          head={['Organization', 'Created', 'Members', 'Seats', 'Invited', 'Pays', 'In Stripe']}
        >
          {organizations.map((org) => {
            const over = org.seats !== null && org.members > org.seats;
            const full =
              org.seats !== null && !over && capStatus(org.members, org.seats) === 'reached';
            return (
              <tr key={org.id} className="border-border border-b" data-testid="org-row">
                <td className={td}>
                  <span className="font-medium">{org.name}</span>
                  <div className="text-fg-muted font-mono text-xs">{org.slug}</div>
                </td>
                <td className={td}>
                  <When at={org.createdAt} date />
                </td>
                <td className={td}>{org.members}</td>
                <td className={td}>
                  {org.seats ?? <span className="text-fg-muted">None</span>}
                  {over && (
                    <span className="ms-2">
                      <Badge tone="error">{org.members - org.seats!} over</Badge>
                    </span>
                  )}
                  {full && (
                    <span className="ms-2">
                      <Badge tone="warning">Full</Badge>
                    </span>
                  )}
                </td>
                <td className={td}>{org.invited}</td>
                <td className={td}>
                  {org.subscription ? (
                    <>
                      {org.subscription.status.replace('_', ' ')}
                      {org.subscription.cancelAtPeriodEnd ? ', ends ' : ', renews '}
                      <When at={org.subscription.currentPeriodEnd} date />
                    </>
                  ) : org.seats ? (
                    'Granted by staff'
                  ) : (
                    <span className="text-fg-muted">—</span>
                  )}
                </td>
                <td className={td}>
                  <StripeLink
                    href={
                      org.stripeCustomerId ? stripeDashboardUrl(org.stripeCustomerId, live) : null
                    }
                  >
                    Open
                  </StripeLink>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
