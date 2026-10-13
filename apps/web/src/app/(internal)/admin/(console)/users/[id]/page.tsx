import { stripeDashboardUrl } from '@oathly/api/billing';
import { getDeletionPlan, getUserForAdmin } from '@oathly/api/server';
import { aiLimits } from '@oathly/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { adminLink, DataTable, StripeLink, td, When } from '@/components/admin/console';
import { Badge, fieldClass, labelClass, Notice } from '@/components/ui';
import { audit, getDb, requireAdmin } from '@/lib/admin';
import { isStripeLive } from '@/lib/billing';

import { deleteUserOnRequest } from '../actions';

export const metadata: Metadata = { title: 'User' };

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-fg-muted text-sm">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

// One account: who it is, what it holds, what it has done, and deleting it
// when its owner asks. Admins only, and opening it is recorded.
export default async function User({ params, searchParams }: PageProps<'/admin/users/[id]'>) {
  const admin = await requireAdmin();
  const id = decodeURIComponent((await params).id);
  const user = await getUserForAdmin(getDb(), id);
  if (!user) notFound();
  await audit(admin, 'user.view', { type: 'user', id });

  const problem = single((await searchParams).problem);
  const deletion = await getDeletionPlan(getDb(), id);
  const live = isStripeLive();
  const allowance = user.pro ? aiLimits.pro : aiLimits.free;
  const { activity } = user;

  return (
    <>
      <p className="text-sm">
        <Link href="/admin/users" className={adminLink}>
          All users
        </Link>
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold">
        {user.displayName || 'Unnamed account'}
        {user.staffRole && (
          <span className="ms-3 align-middle">
            <Badge tone="warning">{user.staffRole}</Badge>
          </span>
        )}
      </h1>
      {problem && (
        <div className="mt-4">
          <Notice tone="error" role="alert">
            {problem}
          </Notice>
        </div>
      )}

      <dl className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Account id">
          <span className="font-mono text-sm break-all">{user.id}</span>
        </Fact>
        <Fact label="Email">{user.email ?? 'Not known here'}</Fact>
        <Fact label="Joined">
          <When at={user.joinedAt} />
        </Fact>
        <Fact label="Last started a session">
          <When at={user.lastActiveAt} />
        </Fact>
        <Fact label="Plan">
          {[
            user.pro ? 'Pro' : null,
            user.passes > 0 ? `${user.passes} Country Pass${user.passes > 1 ? 'es' : ''}` : null,
            user.seats > 0 ? 'Organization seat' : null,
          ]
            .filter(Boolean)
            .join(', ') || 'Free'}
        </Fact>
        <Fact label="Studies">
          {user.studying.length === 0
            ? 'Nothing yet'
            : user.studying
                .map(
                  (study) =>
                    `${study.countryCode}${study.examDate ? ` (exam ${study.examDate})` : ''}`,
                )
                .join(', ')}
        </Fact>
        <Fact label="Stripe customer">
          <StripeLink
            href={user.stripeCustomerId ? stripeDashboardUrl(user.stripeCustomerId, live) : null}
          >
            {user.stripeCustomerId}
          </StripeLink>
        </Fact>
        <Fact label="Organizations">
          {user.organizations.length === 0
            ? 'None'
            : user.organizations.map((org) => `${org.name} (${org.role})`).join(', ')}
        </Fact>
      </dl>

      <h2 className="font-display mt-10 text-xl font-semibold">Subscriptions and purchases</h2>
      {user.subscriptions.length === 0 ? (
        <p className="text-fg-muted mt-2">None.</p>
      ) : (
        <DataTable
          caption="This account’s subscriptions and purchases"
          head={['Plan', 'Status', 'Bought through', 'Renews or ends', 'Started', 'In Stripe']}
        >
          {user.subscriptions.map((held) => (
            <tr key={held.id} className="border-border border-b">
              <td className={td}>
                {held.plan}
                {held.countryCode ? ` (${held.countryCode})` : ''}
              </td>
              <td className={td}>
                {held.status}
                {held.cancelAtPeriodEnd ? ', will not renew' : ''}
              </td>
              <td className={td}>{held.provider}</td>
              <td className={td}>
                <When at={held.currentPeriodEnd} date />
              </td>
              <td className={td}>
                <When at={held.createdAt} date />
              </td>
              <td className={td}>
                <StripeLink
                  href={
                    held.provider === 'stripe' && held.providerId
                      ? stripeDashboardUrl(held.providerId, live)
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

      <h2 className="font-display mt-10 text-xl font-semibold">Activity</h2>
      <dl className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Study sessions">
          {activity.sessions} started, {activity.sessionsFinished} finished
        </Fact>
        <Fact label="Answers given">{activity.answers}</Fact>
        <Fact label="AI explanations, last 24 hours">
          {activity.aiToday.explanation ?? 0} of {allowance.explanation}
        </Fact>
        <Fact label="Tutor messages, last 24 hours">
          {activity.aiToday.tutor ?? 0} of {allowance.tutor}
        </Fact>
        <Fact label="Study group posts">{activity.posts}</Fact>
        <Fact label="Study group comments">{activity.comments}</Fact>
        <Fact label="Questions reported">{activity.reports}</Fact>
      </dl>
      {user.recentSessions.length > 0 && (
        <DataTable
          caption="This account’s most recent study sessions"
          head={['Started', 'Country', 'Kind', 'Result']}
        >
          {user.recentSessions.map((session) => (
            <tr key={session.id} className="border-border border-b">
              <td className={td}>
                <When at={session.startedAt} />
              </td>
              <td className={td}>{session.countryCode}</td>
              <td className={td}>{session.mode}</td>
              <td className={td}>
                {session.finished ? `${session.correct} of ${session.questions}` : 'Not finished'}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <p className="mt-4 text-sm">
        <Link href={`/admin/activity?who=${encodeURIComponent(user.id)}`} className={adminLink}>
          What this account has done in the admin area
        </Link>
      </p>

      <section aria-labelledby="delete" className="border-error mt-12 rounded-lg border p-5">
        <h2 id="delete" className="font-display text-xl font-semibold">
          Delete this account
        </h2>
        <p className="text-fg-muted mt-2 max-w-3xl">
          Only when the account’s owner has asked for it. Their progress, answers, posts and plan
          are removed, any subscription is cancelled so they are not charged again, and the record
          they sign in with is removed. This cannot be undone.
        </p>
        {deletion.blocker ? (
          <p className="mt-3 font-medium">
            {deletion.blocker === 'staff'
              ? 'It cannot be deleted: it has verified published questions, and that record has to stay.'
              : 'It cannot be deleted yet: it owns an organization with other members or paid seats.'}
          </p>
        ) : (
          <form action={deleteUserOnRequest} className="mt-4 max-w-xl space-y-4">
            <input type="hidden" name="id" value={user.id} />
            {deletion.stripeSubscriptionIds.length > 0 && (
              <p className="text-sm">
                Their Stripe subscription will be cancelled now. Refund anything owed in Stripe
                first: after this the account is gone from here.
              </p>
            )}
            {deletion.storesToCancel.length > 0 && (
              <p className="text-sm">
                They have a subscription bought in a phone’s store. Only they can cancel that, in
                the store; tell them.
              </p>
            )}
            <div>
              <label htmlFor="reason" className={labelClass}>
                Who asked, and how
              </label>
              <input
                id="reason"
                name="reason"
                required
                minLength={5}
                maxLength={500}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="confirm" className={labelClass}>
                Type DELETE to confirm
              </label>
              <input
                id="confirm"
                name="confirm"
                required
                autoComplete="off"
                className={`${fieldClass} max-w-40 font-mono`}
              />
            </div>
            <button
              type="submit"
              className="bg-error text-on-error focus-visible:outline-focus-ring rounded-md px-4 py-2 font-semibold hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Delete the account
            </button>
          </form>
        )}
      </section>
    </>
  );
}
