import { formatPrice } from '@oathly/api/billing';
import { getSeats, listStaff } from '@oathly/api/server';
import { orgKinds } from '@oathly/core';
import type { Metadata } from 'next';

import { BRAND_CLASS, BrandStyle, OrgLogo } from '@/components/org/brand';
import { OrgHeader, ProblemNotice } from '@/components/org/org-chrome';
import { SeatSummary } from '@/components/org/seat-summary';
import { PlanRefresher } from '@/components/study/plan-refresher';
import { Badge, buttonClass, fieldClass, focusRing, labelClass, Notice } from '@/components/ui';
import { isSeatBillingConfigured, MAX_SEATS_PER_CHECKOUT, seatPrice } from '@/lib/billing';
import { getDb } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { logoSrc, requireOrgAdmin } from '@/lib/org';

import { buySeats, deleteLogo, openOrgPortal, remove, saveDetails } from '../../actions';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/org/[slug]/settings'>): Promise<Metadata> {
  return { title: (await getT(params)).t('org.metaTitle') };
}

const kindLabel = {
  law_firm: 'org.kindLawFirm',
  school: 'org.kindSchool',
  nonprofit: 'org.kindNonprofit',
  other: 'org.kindOther',
} as const;

// An organization's details, its look on learners' dashboards, its seats and
// the people who run it.
export default async function OrgSettings({
  params,
  searchParams,
}: PageProps<'/[locale]/org/[slug]/settings'>) {
  const { locale, t } = await getT(params);
  const { slug } = await params;
  const { user, access } = await requireOrgAdmin(locale, slug);
  const { organization } = access;
  const query = await searchParams;
  const db = getDb();
  const [seats, staff, price] = await Promise.all([
    getSeats(db, organization.id, access.granted),
    listStaff(db, user.userId, organization.id),
    seatPrice(),
  ]);
  const canBuy = isSeatBillingConfigured();
  const logo = logoSrc(organization);
  const { subscription } = seats;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });
  const card = 'bg-surface border-border rounded-lg border p-5 sm:p-6';
  const heading = 'font-display text-2xl font-semibold';

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      {query.seats === 'bought' && <PlanRefresher />}
      <OrgHeader t={t} organization={organization} current="settings" />
      <ProblemNotice t={t} problem={query.error} />
      {(query.saved === '1' || query.seats === 'bought') && (
        <div className="mt-6">
          <Notice tone="success" role="status">
            {query.seats === 'bought' ? t('org.seatsThanks') : t('org.saved')}
          </Notice>
        </div>
      )}

      <section aria-labelledby="seats" className={`${card} mt-8`}>
        <h2 id="seats" className={heading}>
          {t('org.seats')}
        </h2>
        <div className="mt-4 space-y-2">
          <SeatSummary t={t} seats={seats} />
          <p className="text-fg-muted text-sm">{t('org.seatsExplain')}</p>
          {seats.granted > 0 && (
            <p className="text-fg-muted text-sm">
              {t('org.seatsGranted', { count: seats.granted })}
            </p>
          )}
          {subscription && (
            <p className="text-fg-muted text-sm">
              {!subscription.inForce
                ? t('org.seatsEnded')
                : subscription.currentPeriodEnd &&
                  t(subscription.cancelAtPeriodEnd ? 'org.seatsEnd' : 'org.seatsRenew', {
                    date: date.format(new Date(subscription.currentPeriodEnd)),
                  })}
            </p>
          )}
        </div>
        {!canBuy ? (
          <p className="text-fg-muted mt-4 text-sm">{t('org.billingUnavailable')}</p>
        ) : subscription?.inForce ? (
          <form action={openOrgPortal} className="mt-5">
            <input type="hidden" name="organizationId" value={organization.id} />
            <button type="submit" className={buttonClass.secondary}>
              {t('org.manageBilling')}
            </button>
          </form>
        ) : (
          <form action={buySeats} className="mt-5 flex flex-wrap items-end gap-3">
            <input type="hidden" name="organizationId" value={organization.id} />
            <div>
              <label htmlFor="seat-count" className={labelClass}>
                {t('org.seatCount')}
              </label>
              <input
                id="seat-count"
                name="seats"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_SEATS_PER_CHECKOUT}
                defaultValue={Math.max(5, seats.used)}
                required
                className={`${fieldClass} w-32`}
              />
            </div>
            <button type="submit" className={buttonClass.primary}>
              {t('org.buySeats')}
            </button>
            {price && (
              <p className="text-fg-muted w-full text-sm">
                {t(price.interval === 'year' ? 'org.perSeatYear' : 'org.perSeatMonth', {
                  price: formatPrice(price, locale),
                })}
              </p>
            )}
          </form>
        )}
      </section>

      <section aria-labelledby="details" className={`${card} mt-6`}>
        <h2 id="details" className={heading}>
          {t('org.details')}
        </h2>
        <form action={saveDetails} className="mt-5 space-y-5">
          <input type="hidden" name="organizationId" value={organization.id} />
          <div>
            <label htmlFor="org-name" className={labelClass}>
              {t('org.name')}
            </label>
            <input
              id="org-name"
              name="name"
              required
              maxLength={120}
              defaultValue={organization.name}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="org-kind" className={labelClass}>
              {t('org.kind')}
            </label>
            <select
              id="org-kind"
              name="kind"
              defaultValue={organization.kind}
              className={fieldClass}
            >
              {orgKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {t(kindLabel[kind])}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="border-border border-t pt-5">
            <legend className="font-display text-xl font-semibold">{t('org.branding')}</legend>
            <p className="text-fg-muted mt-1 text-sm">{t('org.brandingHelp')}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['brandColor', t('org.brandColor'), organization.brand.color],
                  ['brandAccent', t('org.brandAccent'), organization.brand.accent],
                ] as const
              ).map(([name, label, value]) => (
                <div key={name}>
                  <label htmlFor={name} className={labelClass}>
                    {label}
                  </label>
                  {/* Text, not a colour picker: a picker cannot be left empty. */}
                  <input
                    id={name}
                    name={name}
                    defaultValue={value ?? ''}
                    pattern="#[0-9a-fA-F]{6}"
                    placeholder="#0b5fff"
                    dir="ltr"
                    spellCheck={false}
                    autoCapitalize="none"
                    aria-describedby="color-hint"
                    className={`${fieldClass} font-mono`}
                  />
                </div>
              ))}
            </div>
            <p id="color-hint" className="text-fg-muted mt-1 text-sm">
              {t('org.colorHint')}
            </p>
            <div className="mt-4">
              <label htmlFor="org-logo" className={labelClass}>
                {t('org.logo')}
              </label>
              {logo && (
                <div className="mb-3">
                  <OrgLogo
                    src={logo}
                    alt={t('org.logoAlt', { organization: organization.name })}
                    className="h-14"
                  />
                </div>
              )}
              <input
                id="org-logo"
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-describedby="logo-hint"
                className={`${focusRing} text-fg-muted file:border-border-strong file:text-fg block w-full rounded-sm text-sm file:me-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-2 file:font-semibold`}
              />
              <p id="logo-hint" className="text-fg-muted mt-1 text-sm">
                {t('org.logoHint')}
              </p>
            </div>
          </fieldset>
          <button type="submit" className={buttonClass.primary}>
            {t('org.save')}
          </button>
        </form>
        {logo && (
          <form action={deleteLogo} className="mt-3">
            <input type="hidden" name="organizationId" value={organization.id} />
            <button
              type="submit"
              className={`${focusRing} text-error-fg rounded-xs text-sm underline underline-offset-4`}
            >
              {t('org.logoRemove')}
            </button>
          </form>
        )}

        {(organization.brand.color || organization.brand.accent) && (
          <div className="border-border mt-6 border-t pt-5">
            <BrandStyle brand={organization.brand} />
            <h3 className="font-display text-xl font-semibold">{t('org.preview')}</h3>
            {/* The saved colours as a learner's dashboard will use them, in this theme. */}
            <div
              className={`${BRAND_CLASS} bg-canvas border-border mt-3 flex flex-wrap items-center gap-4 rounded-lg border p-5`}
            >
              {logo && <OrgLogo src={logo} />}
              <span className={buttonClass.primary}>{t('org.previewButton')}</span>
              <span className="text-primary-fg font-medium underline underline-offset-4">
                {t('org.previewLink')}
              </span>
              <Badge>{t('org.standingOnTrack')}</Badge>
              <Badge tone="warning">{t('org.summaryBehind')}</Badge>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="team" className={`${card} mt-6`}>
        <h2 id="team" className={heading}>
          {t('org.team')}
        </h2>
        <ul className="divide-border mt-4 divide-y">
          {staff.map((person) => (
            <li key={person.userId} className="flex flex-wrap items-center gap-3 py-3">
              <span className="font-medium" dir="auto">
                {person.name ?? person.email ?? '–'}
              </span>
              {person.name && person.email && (
                <span className="text-fg-muted text-sm" dir="ltr">
                  {person.email}
                </span>
              )}
              <Badge>{t(person.role === 'owner' ? 'org.roleOwner' : 'org.roleAdmin')}</Badge>
              {access.role === 'owner' && person.role === 'admin' && (
                <form action={remove} className="ms-auto">
                  <input type="hidden" name="organizationId" value={organization.id} />
                  <input type="hidden" name="userId" value={person.userId} />
                  <input type="hidden" name="from" value="/settings" />
                  <button
                    type="submit"
                    className={`${focusRing} text-error-fg rounded-xs text-sm underline underline-offset-4`}
                  >
                    {t('org.remove')}
                    <span className="sr-only">: {person.name ?? person.email ?? ''}</span>
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-fg-muted mt-10 text-sm">{t('common.notAffiliated')}</p>
    </main>
  );
}
