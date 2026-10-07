import { getSeats, listExamCountries, listInvites } from '@oathly/api/server';
import { countryName, localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';

import { I18nProvider } from '@/components/i18n/provider';
import { InviteForm, ResendInvite } from '@/components/org/invite-forms';
import { OrgHeader, ProblemNotice } from '@/components/org/org-chrome';
import { SeatSummary } from '@/components/org/seat-summary';
import { Badge, focusRing } from '@/components/ui';
import { getDb } from '@/lib/db';
import { clientMessages, getT } from '@/lib/i18n';
import { requireOrgAdmin } from '@/lib/org';
import Link from 'next/link';

import { withdrawInvite } from '../../actions';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/org/[slug]/invite'>): Promise<Metadata> {
  return { title: (await getT(params)).t('org.metaTitle') };
}

// Inviting people, and the invitations still out.
export default async function OrgInvite({
  params,
  searchParams,
}: PageProps<'/[locale]/org/[slug]/invite'>) {
  const { locale, t } = await getT(params);
  const { slug } = await params;
  const { user, access } = await requireOrgAdmin(locale, slug);
  const { organization } = access;
  const db = getDb();
  const [seats, invites, countries] = await Promise.all([
    getSeats(db, organization.id, access.granted),
    listInvites(db, user.userId, organization.id),
    listExamCountries(db),
  ]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const nameOf = (code: string) =>
    countryName(code, locale, countries.find((country) => country.isoCode === code)?.name ?? code);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <OrgHeader t={t} organization={organization} current="invite" />
      <ProblemNotice t={t} problem={(await searchParams).error} />

      <I18nProvider locale={locale} messages={clientMessages(locale, ['org'])}>
        <section aria-labelledby="invite" className="mt-8">
          <h2 id="invite" className="font-display text-2xl font-semibold">
            {t('org.inviteTitle')}
          </h2>
          <div className="mt-4">
            <SeatSummary t={t} seats={seats} />
            <p className="text-fg-muted mt-2 text-sm">
              {t('org.seatsExplain')}{' '}
              <Link
                href={localizePath(locale, `/org/${organization.slug}/settings`)}
                className={`${focusRing} text-primary-fg rounded-xs underline underline-offset-4`}
              >
                {t('org.buySeats')}
              </Link>
            </p>
          </div>
          <div className="bg-surface border-border mt-6 rounded-lg border p-5 sm:p-6">
            <InviteForm
              organizationId={organization.id}
              countries={countries}
              canInviteAdmins={access.role === 'owner'}
              today={new Date().toISOString().slice(0, 10)}
            />
          </div>
        </section>

        <section aria-labelledby="pending" className="mt-12">
          <h2 id="pending" className="font-display text-2xl font-semibold">
            {t('org.pending')}
          </h2>
          {invites.length === 0 ? (
            <p className="text-fg-muted mt-4">{t('org.noPending')}</p>
          ) : (
            <ul className="divide-border border-border bg-surface mt-4 divide-y rounded-lg border">
              {invites.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-start gap-x-6 gap-y-2 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold break-all" dir="ltr">
                      {invite.email}
                    </p>
                    <p className="text-fg-muted text-sm">
                      {[
                        invite.name,
                        invite.role === 'admin' ? t('org.roleAdmin') : null,
                        invite.countryCode ? nameOf(invite.countryCode) : null,
                        t('org.invitedOn', { date: date.format(new Date(invite.createdAt)) }),
                        invite.expired
                          ? null
                          : t('org.expiresOn', { date: date.format(new Date(invite.expiresAt)) }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {invite.expired && <Badge tone="warning">{t('org.expired')}</Badge>}
                  </div>
                  <ResendInvite
                    organizationId={organization.id}
                    inviteId={invite.id}
                    email={invite.email}
                    role={invite.role}
                  />
                  <form action={withdrawInvite}>
                    <input type="hidden" name="organizationId" value={organization.id} />
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button
                      type="submit"
                      className={`${focusRing} text-error-fg rounded-xs font-medium underline underline-offset-4`}
                    >
                      {t('org.revoke')}
                      <span className="sr-only">: {invite.email}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </I18nProvider>

      <p className="text-fg-muted mt-10 text-sm">{t('common.notAffiliated')}</p>
    </main>
  );
}
