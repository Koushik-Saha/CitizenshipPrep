'use client';

import type { ExamCountry } from '@oathly/api';
import { INVITE_LIST_LIMIT, type InviteProblem } from '@oathly/core';
import { countryName } from '@oathly/i18n';
import { useActionState, useState } from 'react';

import {
  resendInvite,
  sendInvites,
  type InviteState,
  type ResendState,
} from '@/app/[locale]/org/actions';
import { useT } from '@/components/i18n/provider';
import { buttonClass, fieldClass, focusRing, labelClass, Notice } from '@/components/ui';

const problemLabel: Record<InviteProblem, `org.problem${string}`> = {
  'bad-email': 'org.problemBadEmail',
  duplicate: 'org.problemDuplicate',
  'unknown-country': 'org.problemUnknownCountry',
  'bad-date': 'org.problemBadDate',
  'past-date': 'org.problemPastDate',
};

const errorLabel = {
  nothing: 'org.inviteNothing',
  'no-seats': 'org.seatsNone',
  'not-found': 'org.errorNotFound',
  forbidden: 'org.errorForbidden',
  invalid: 'org.errorInvalid',
  'invite-gone': 'org.errorInviteGone',
  'wrong-address': 'org.errorWrongAddress',
  'bad-logo': 'org.errorBadLogo',
} as const;

/** A link to pass on by hand: shown in full, selectable in one go. */
function LinkField({ label, url }: { label: string; url: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium" dir="ltr">
        {label}
      </span>
      <input
        readOnly
        value={url}
        dir="ltr"
        onFocus={(event) => event.currentTarget.select()}
        className={`${fieldClass} mt-1 font-mono text-xs`}
      />
    </label>
  );
}

const initial: InviteState = {
  done: false,
  error: null,
  emailed: 0,
  links: [],
  alreadyMembers: [],
  noSeats: [],
  problems: [],
  overLimit: 0,
};

/**
 * Invites a list of people: addresses typed or pasted, or a CSV file. What
 * came of the list is shown under the form, including any invitation links
 * that have to be passed on by hand.
 */
export function InviteForm({
  organizationId,
  countries,
  canInviteAdmins,
  today,
}: {
  organizationId: string;
  countries: ExamCountry[];
  /** Only the owner invites people to help run the organization. */
  canInviteAdmins: boolean;
  /** YYYY-MM-DD: target dates are in the future. */
  today: string;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(sendInvites, initial);
  const [role, setRole] = useState<'member' | 'admin'>('member');

  return (
    <div>
      <form action={action} className="space-y-5">
        <input type="hidden" name="organizationId" value={organizationId} />
        <div>
          <label htmlFor="invite-emails" className={labelClass}>
            {t('org.inviteEmails')}
          </label>
          <textarea
            id="invite-emails"
            name="emails"
            rows={5}
            dir="ltr"
            spellCheck={false}
            autoCapitalize="none"
            aria-describedby="invite-help"
            className={`${fieldClass} font-mono text-sm`}
          />
          <p id="invite-help" className="text-fg-muted mt-1 text-sm">
            {t('org.inviteHelp')}
          </p>
        </div>
        <div>
          <label htmlFor="invite-file" className={labelClass}>
            {t('org.inviteFile')}
          </label>
          <input
            id="invite-file"
            name="file"
            type="file"
            accept=".csv,text/csv,text/plain"
            className={`${focusRing} text-fg-muted file:border-border-strong file:text-fg block w-full rounded-sm text-sm file:me-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-2 file:font-semibold`}
          />
        </div>

        {canInviteAdmins && (
          <fieldset>
            <legend className={labelClass}>{t('org.inviteRole')}</legend>
            <div className="space-y-1">
              {(
                [
                  ['member', t('org.inviteAsLearners')],
                  ['admin', t('org.inviteAsAdmins')],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={role === value}
                    onChange={() => setRole(value)}
                    className={focusRing}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {role === 'member' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="invite-country" className={labelClass}>
                {t('org.inviteCountry')}
              </label>
              <select id="invite-country" name="countryCode" className={fieldClass} defaultValue="">
                <option value="">{t('org.inviteNoCountry')}</option>
                {countries.map((country) => (
                  <option key={country.isoCode} value={country.isoCode}>
                    {countryName(country.isoCode, t.locale, country.name)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="invite-date" className={labelClass}>
                {t('org.inviteDate')}
              </label>
              <input
                id="invite-date"
                name="targetDate"
                type="date"
                min={today}
                className={fieldClass}
              />
            </div>
          </div>
        )}

        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {t('org.inviteButton')}
        </button>
      </form>

      {/* Announced when the list has been dealt with. */}
      <div role="status" className="mt-6 space-y-4">
        {state.done && state.error && <Notice tone="error">{t(errorLabel[state.error])}</Notice>}
        {state.emailed > 0 && (
          <Notice tone="success">{t('org.inviteSent', { count: state.emailed })}</Notice>
        )}
        {state.links.length > 0 && (
          <section
            aria-labelledby="invite-links"
            className="bg-surface border-border rounded-lg border p-5"
          >
            <h3 id="invite-links" className="font-display text-xl font-semibold">
              {t('org.inviteLinks')}
            </h3>
            <p className="mt-1">{t('org.inviteNotSent', { count: state.links.length })}</p>
            <p className="text-fg-muted mt-1 text-sm">{t('org.inviteLinkNote')}</p>
            <div className="mt-4 space-y-3">
              {state.links.map((link) => (
                <LinkField key={link.email} label={link.email} url={link.url} />
              ))}
            </div>
          </section>
        )}
        {state.noSeats.length > 0 && (
          <Notice tone="warning">
            {t('org.inviteNoSeats', { emails: state.noSeats.join(', ') })}
          </Notice>
        )}
        {state.alreadyMembers.length > 0 && (
          <Notice tone="neutral">
            {t('org.inviteAlreadyMembers', { emails: state.alreadyMembers.join(', ') })}
          </Notice>
        )}
        {state.problems.length > 0 && (
          <Notice tone="warning">
            <p className="font-semibold">{t('org.inviteProblems')}</p>
            <ul className="mt-2 list-disc space-y-1 ps-5">
              {state.problems.map((problem) => (
                <li key={`${problem.line}-${problem.value}-${problem.problem}`}>
                  <span dir="auto">
                    {t('org.inviteLine', { line: problem.line, value: problem.value })}
                  </span>
                  {' – '}
                  {t(problemLabel[problem.problem] as 'org.problemBadEmail')}
                </li>
              ))}
            </ul>
          </Notice>
        )}
        {state.overLimit > 0 && (
          <Notice tone="warning">
            {t('org.inviteOverLimit', { count: state.overLimit, limit: INVITE_LIST_LIMIT })}
          </Notice>
        )}
      </div>
    </div>
  );
}

const resendInitial: ResendState = { done: false, error: null, emailed: false, url: null };

/** "Send again" for one pending invitation: a new link, emailed or shown. */
export function ResendInvite({
  organizationId,
  inviteId,
  email,
  role,
}: {
  organizationId: string;
  inviteId: string;
  email: string;
  role: 'member' | 'admin';
}) {
  const t = useT();
  const [state, action, pending] = useActionState(resendInvite, resendInitial);
  return (
    <div>
      <form action={action}>
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="inviteId" value={inviteId} />
        <input type="hidden" name="role" value={role} />
        <button
          type="submit"
          disabled={pending}
          className={`${focusRing} text-primary-fg rounded-xs font-medium underline underline-offset-4 disabled:opacity-50`}
        >
          {t('org.resend')}
          <span className="sr-only">: {email}</span>
        </button>
      </form>
      <div role="status">
        {state.done && state.error && (
          <p className="text-error-fg mt-2 text-sm">{t(errorLabel[state.error])}</p>
        )}
        {state.emailed && (
          <p className="text-success-fg mt-2 text-sm">{t('org.inviteSent', { count: 1 })}</p>
        )}
        {state.url && (
          <div className="mt-2 w-72 max-w-full">
            <LinkField label={t('org.inviteNotSent', { count: 1 })} url={state.url} />
          </div>
        )}
      </div>
    </div>
  );
}
