import { formatPrice, stripeDashboardUrl } from '@oathly/api/billing';
import {
  listSubscriptionsForAdmin,
  ownersOfStripeCustomers,
  subscriptionStatuses,
  type AdminSubscription,
} from '@oathly/api/server';
import type { Metadata } from 'next';
import Link from 'next/link';

import { adminLink, DataTable, StripeLink, td, UserLink, When } from '@/components/admin/console';
import { Badge, Notice } from '@/components/ui';
import { getDb, requireAdmin } from '@/lib/admin';
import { getStripe, isStripeLive } from '@/lib/billing';
import { reportError } from '@/lib/monitoring';

export const metadata: Metadata = { title: 'Subscriptions and payments' };

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function Owner({ owner }: { owner: AdminSubscription['owner'] | undefined }) {
  if (!owner) return <span className="text-fg-muted">Not an Swornly customer</span>;
  return owner.kind === 'user' ? (
    <UserLink id={owner.id} name={owner.name} />
  ) : (
    <span>{owner.name} (organization)</span>
  );
}

interface Payment {
  id: string;
  /** What to open in Stripe to refund it. */
  page: string;
  amount: string;
  status: string;
  refunded: 'no' | 'part' | 'all';
  customer: string | null;
  at: string;
}

/** The latest payments, as Stripe has them. Null when Stripe is not set up or cannot be reached. */
async function recentPayments(): Promise<Payment[] | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  try {
    const charges = await getStripe().charges.list({ limit: 25 });
    return charges.data.map((charge) => ({
      id: charge.id,
      page: typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.id,
      amount: formatPrice({ amount: charge.amount, currency: charge.currency }, 'en'),
      status: charge.status,
      refunded: charge.refunded ? 'all' : charge.amount_refunded > 0 ? 'part' : 'no',
      customer: typeof charge.customer === 'string' ? charge.customer : null,
      at: new Date(charge.created * 1000).toISOString(),
    }));
  } catch (error) {
    reportError(error, { where: 'admin-billing', step: 'list-charges' });
    return null;
  }
}

// What people hold and what they have paid. Refunds are made in Stripe, which
// tells this server when one is; each row links to the right page there.
// Admins only. Nothing on this page changes anything.
export default async function Billing({ searchParams }: PageProps<'/admin/billing'>) {
  await requireAdmin();
  const status = single((await searchParams).status);
  const [subscriptions, payments] = await Promise.all([
    listSubscriptionsForAdmin(getDb(), { status }),
    recentPayments(),
  ]);
  const live = isStripeLive();
  const payers = await ownersOfStripeCustomers(
    getDb(),
    (payments ?? []).flatMap((payment) => (payment.customer ? [payment.customer] : [])),
  );

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Subscriptions and payments</h1>
      <p className="text-fg-muted mt-1 max-w-3xl">
        Refunds are made in Stripe: open the payment there. This site is told when one is made, and
        takes back what was bought.
      </p>

      <h2 className="font-display mt-8 text-xl font-semibold">Subscriptions and purchases</h2>
      <nav aria-label="Status" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link
          href="/admin/billing"
          className={adminLink}
          aria-current={status ? undefined : 'page'}
        >
          All
        </Link>
        {subscriptionStatuses.map((name) => (
          <Link
            key={name}
            href={`/admin/billing?status=${name}`}
            className={adminLink}
            aria-current={status === name ? 'page' : undefined}
          >
            {name.replace('_', ' ')}
          </Link>
        ))}
      </nav>
      {subscriptions.length === 0 ? (
        <p className="text-fg-muted mt-6">None{status ? ' with that status' : ' yet'}.</p>
      ) : (
        <DataTable
          caption="Subscriptions and purchases"
          head={['Whose', 'Plan', 'Status', 'Through', 'Renews or ends', 'Started', 'In Stripe']}
        >
          {subscriptions.map((held) => (
            <tr key={held.id} className="border-border border-b" data-testid="subscription-row">
              <td className={td}>
                <Owner owner={held.owner} />
              </td>
              <td className={td}>
                {held.plan}
                {held.countryCode ? ` (${held.countryCode})` : ''}
                {held.seats ? `, ${held.seats} seats` : ''}
              </td>
              <td className={td}>
                <Badge
                  tone={
                    held.status === 'active' || held.status === 'trialing'
                      ? 'success'
                      : held.status === 'past_due'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {held.status.replace('_', ' ')}
                </Badge>
                {held.cancelAtPeriodEnd && <span className="ms-2">will not renew</span>}
              </td>
              <td className={td}>{held.provider.replace('_', ' ')}</td>
              <td className={td}>
                <When at={held.currentPeriodEnd} date />
              </td>
              <td className={td}>
                <When at={held.createdAt} date />
              </td>
              <td className={td}>
                <StripeLink
                  href={
                    held.provider === 'stripe'
                      ? ((held.providerId && stripeDashboardUrl(held.providerId, live)) ??
                        (held.stripeCustomerId &&
                          stripeDashboardUrl(held.stripeCustomerId, live)) ??
                        null)
                      : null
                  }
                >
                  Open, refund
                </StripeLink>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <h2 className="font-display mt-12 text-xl font-semibold">Latest payments</h2>
      {payments === null ? (
        <div className="mt-3 max-w-3xl">
          <Notice tone="neutral">
            {process.env.STRIPE_SECRET_KEY
              ? 'Stripe could not be reached just now. Reload to try again.'
              : 'Stripe is not set up on this server, so there are no payments to show.'}
          </Notice>
        </div>
      ) : payments.length === 0 ? (
        <p className="text-fg-muted mt-3">No payments yet.</p>
      ) : (
        <DataTable
          caption="The latest payments, from Stripe"
          head={['When (UTC)', 'Who', 'Amount', 'Status', 'Refunded', 'In Stripe']}
        >
          {payments.map((payment) => (
            <tr key={payment.id} className="border-border border-b">
              <td className={td}>
                <When at={payment.at} />
              </td>
              <td className={td}>
                <Owner owner={payment.customer ? payers.get(payment.customer) : undefined} />
              </td>
              <td className={td}>{payment.amount}</td>
              <td className={td}>{payment.status}</td>
              <td className={td}>
                {payment.refunded === 'all'
                  ? 'Yes'
                  : payment.refunded === 'part'
                    ? 'In part'
                    : 'No'}
              </td>
              <td className={td}>
                <StripeLink href={stripeDashboardUrl(payment.page, live)}>
                  {payment.refunded === 'all' ? 'Open' : 'Open, refund'}
                </StripeLink>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <p className="text-fg-muted mt-4 text-sm">
        {live ? 'Live payments.' : 'Stripe is in test mode here: these are not real payments.'}{' '}
        Purchases made in the phone apps are refunded by Apple or Google, not here.
      </p>
    </>
  );
}
