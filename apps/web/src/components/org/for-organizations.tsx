import { formatPrice } from '@oathly/api/billing';
import { localizePath, type Translator } from '@oathly/i18n';
import Link from 'next/link';

import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { buttonClass, focusRing } from '@/components/ui';
import { isSeatBillingConfigured, seatPrice } from '@/lib/billing';

const features = [
  'org.publicInvite',
  'org.publicDashboard',
  'org.publicFull',
  'org.publicPrivacy',
  'org.publicBrand',
] as const;

/**
 * /org for someone signed out: what an organization gets, what a seat costs
 * (or that seats are not sold yet, and who to write to), and how to start.
 * Everything listed here is what /org and /org/[slug] do once signed in.
 */
export async function ForOrganizations({ t }: { t: Translator }) {
  const price = isSeatBillingConfigured() ? await seatPrice() : null;
  const link = `${focusRing} text-primary-fg rounded-xs font-medium underline underline-offset-4`;
  return (
    <>
      <SiteHeader t={t} path="/org" />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">
          {t('org.forOrganizations')}
        </h1>
        <p className="text-fg-muted mt-4 max-w-prose text-lg">{t('org.intro')}</p>

        <section aria-labelledby="org-features" className="mt-12">
          <h2 id="org-features" className="font-display text-2xl font-semibold">
            {t('org.publicFeaturesTitle')}
          </h2>
          <ul className="mt-4 list-disc space-y-3 ps-5">
            {features.map((feature) => (
              <li key={feature}>{t(feature)}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="org-pricing" className="mt-12">
          <h2 id="org-pricing" className="font-display text-2xl font-semibold">
            {t('org.publicPricingTitle')}
          </h2>
          <p className="mt-4" data-testid="org-pricing">
            {price
              ? t(price.interval === 'year' ? 'org.perSeatYear' : 'org.perSeatMonth', {
                  price: formatPrice(price, t.locale),
                })
              : t('org.publicPricingSoon')}
          </p>
          <p className="mt-4">
            <Link href={localizePath(t.locale, '/contact')} className={link}>
              {t('org.publicContact')}
            </Link>
          </p>
        </section>

        <div className="mt-12">
          <Link href={localizePath(t.locale, '/sign-in')} className={buttonClass.primary}>
            {t('org.publicStart')}
          </Link>
          <p className="text-fg-muted mt-4 text-sm">{t('org.publicInvited')}</p>
        </div>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
