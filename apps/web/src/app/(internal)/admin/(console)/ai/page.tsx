import { aiRequestsLastDay, aiUsageByDay, aiUsageByUserLastDay } from '@oathly/api/server';
import { aiDailyLimit, aiLimits, capStatus, totalAiCostUsd, type AiTokens } from '@oathly/core';
import type { Metadata } from 'next';

import { DataTable, td, UserLink } from '@/components/admin/console';
import { Badge, Notice } from '@/components/ui';
import { getDb, requireAdmin } from '@/lib/admin';
import { isAiSwitchedOff } from '@/lib/ai';

export const metadata: Metadata = { title: 'AI use' };

const dollars = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const whole = new Intl.NumberFormat('en');

function Cost({ tokens }: { tokens: readonly AiTokens[] }) {
  const { usd, unpriced } = totalAiCostUsd(tokens);
  return (
    <>
      {dollars.format(usd)}
      {unpriced > 0 && <span className="text-fg-muted"> + some not priced</span>}
    </>
  );
}

const sum = (tokens: readonly AiTokens[], field: 'input' | 'output') =>
  tokens.reduce((total, lot) => total + lot[field], 0);

/** "12 of 20", marked when it is close to the limit or at it. */
function Against({ used, limit }: { used: number; limit: number }) {
  const status = capStatus(used, limit);
  return (
    <>
      {used} of {limit}
      {status !== 'ok' && used > 0 && (
        <span className="ms-2">
          <Badge tone={status === 'reached' ? 'error' : 'warning'}>
            {status === 'reached' ? 'At the limit' : 'Close'}
          </Badge>
        </span>
      )}
    </>
  );
}

// What the AI features are costing, by day and by learner, against the
// limits that hold them: a number of requests a day for each learner, and one
// for the whole service. Admins only. Costs are worked out from the tokens
// each request used at the model's list price, so they are an estimate: the
// bill is in the Anthropic console.
export default async function AiUse() {
  await requireAdmin();
  const [days, usedToday, users] = await Promise.all([
    aiUsageByDay(getDb(), 14),
    aiRequestsLastDay(getDb()),
    aiUsageByUserLastDay(getDb()),
  ]);
  const limit = aiDailyLimit(process.env.AI_DAILY_LIMIT);
  const service = capStatus(usedToday, limit);
  const everyoneStopped = usedToday >= limit * 2;
  const atTheirLimit = users.filter((user) => {
    const allowance = user.pro ? aiLimits.pro : aiLimits.free;
    return (
      (user.requests.explanation ?? 0) >= allowance.explanation ||
      (user.requests.tutor ?? 0) >= allowance.tutor
    );
  });
  const switchedOff = (['tutor', 'explanation'] as const).filter((feature) =>
    isAiSwitchedOff(feature),
  );

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">AI use</h1>
      <p className="text-fg-muted mt-1 max-w-3xl">
        Requests to Claude and what they cost, estimated from the tokens used at list price. The
        bill itself is in the Anthropic console. Days are in UTC; the limits count the last 24
        hours. Free accounts made in the last day share a quarter of the service’s limit between
        them, so new accounts made in bulk cannot use up the day for everyone else.
      </p>

      <div className="mt-6 max-w-3xl space-y-3">
        {service === 'reached' && (
          <Notice tone="error" role="alert">
            {everyoneStopped
              ? `The service has made ${whole.format(usedToday)} AI requests in the last 24 hours, twice the daily limit of ${whole.format(limit)}. AI help is paused for everyone until use falls.`
              : `The daily limit has been reached: ${whole.format(usedToday)} of ${whole.format(limit)} AI requests in the last 24 hours. AI help is paused for learners on the Free plan; Pro continues up to twice the limit.`}
          </Notice>
        )}
        {service === 'near' && (
          <Notice tone="warning" role="status">
            AI use is close to the daily limit: {whole.format(usedToday)} of {whole.format(limit)}{' '}
            requests in the last 24 hours.
          </Notice>
        )}
        {atTheirLimit.length > 0 && (
          <Notice tone="warning" role="status">
            {atTheirLimit.length === 1
              ? 'One learner has reached their own daily limit.'
              : `${atTheirLimit.length} learners have reached their own daily limit.`}{' '}
            They are marked below.
          </Notice>
        )}
        {switchedOff.length > 0 && (
          <Notice tone="neutral">
            Switched off on this server:{' '}
            {switchedOff
              .map((feature) => (feature === 'tutor' ? 'the tutor' : 'explanations'))
              .join(' and ')}
            .
          </Notice>
        )}
      </div>

      <dl className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-3">
        <div>
          <dt className="text-fg-muted text-sm">Whole service, last 24 hours</dt>
          <dd className="mt-0.5 text-lg font-medium" data-testid="ai-service-use">
            {whole.format(usedToday)} of {whole.format(limit)} requests
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted text-sm">Each learner on Free, a day</dt>
          <dd className="mt-0.5 font-medium">
            {aiLimits.free.explanation} explanations, {aiLimits.free.tutor} tutor messages
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted text-sm">Each learner on Pro, a day</dt>
          <dd className="mt-0.5 font-medium">
            {aiLimits.pro.explanation} explanations, {aiLimits.pro.tutor} tutor messages
          </dd>
        </div>
      </dl>

      <h2 className="font-display mt-10 text-xl font-semibold">By day</h2>
      {days.length === 0 ? (
        <p className="text-fg-muted mt-3">No AI requests in the last 14 days.</p>
      ) : (
        <DataTable
          caption="AI use for each of the last 14 days"
          head={['Day (UTC)', 'Requests', 'Learners', 'Tokens in', 'Tokens out', 'Cost (estimate)']}
        >
          {days.map((day) => (
            <tr key={day.day} className="border-border border-b" data-testid="ai-day">
              <td className={td}>{day.day}</td>
              <td className={td}>{whole.format(day.requests)}</td>
              <td className={td}>{whole.format(day.users)}</td>
              <td className={td}>{whole.format(sum(day.tokens, 'input'))}</td>
              <td className={td}>{whole.format(sum(day.tokens, 'output'))}</td>
              <td className={td}>
                <Cost tokens={day.tokens} />
              </td>
            </tr>
          ))}
          <tr className="font-medium">
            <td className={td}>14 days</td>
            <td className={td}>
              {whole.format(days.reduce((total, day) => total + day.requests, 0))}
            </td>
            <td className={td} />
            <td className={td} />
            <td className={td} />
            <td className={td}>
              <Cost tokens={days.flatMap((day) => day.tokens)} />
            </td>
          </tr>
        </DataTable>
      )}

      <h2 className="font-display mt-10 text-xl font-semibold">By learner, last 24 hours</h2>
      {users.length === 0 ? (
        <p className="text-fg-muted mt-3">Nobody has used the AI in the last 24 hours.</p>
      ) : (
        <DataTable
          caption="The learners who used the AI most in the last 24 hours"
          head={['Learner', 'Plan', 'Explanations', 'Tutor messages', 'Cost (estimate)']}
        >
          {users.map((user) => {
            const allowance = user.pro ? aiLimits.pro : aiLimits.free;
            return (
              <tr key={user.userId} className="border-border border-b" data-testid="ai-user">
                <td className={td}>
                  <UserLink id={user.userId} name={user.displayName} />
                </td>
                <td className={td}>{user.pro ? 'Pro' : 'Free'}</td>
                <td className={td}>
                  <Against used={user.requests.explanation ?? 0} limit={allowance.explanation} />
                </td>
                <td className={td}>
                  <Against used={user.requests.tutor ?? 0} limit={allowance.tutor} />
                </td>
                <td className={td}>
                  <Cost tokens={user.tokens} />
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
