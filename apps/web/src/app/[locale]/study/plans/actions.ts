'use server';

import { purchaseProblem, type Purchase } from '@oathly/api/billing';
import { parseCountryCode } from '@oathly/api/country-search';
import { accessUser } from '@oathly/api/server';
import { isUiLocale, localizePath, type UiLocale } from '@oathly/i18n';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { createCheckout, createPortal, isBillingConfigured, siteOrigin } from '@/lib/billing';
import { getDb } from '@/lib/db';
import { LOCALE_COOKIE } from '@/lib/locale-cookie';
import { currentUser } from '@/lib/user';

// Buying and managing a plan on the web. Both hand the learner to a page
// hosted by Stripe; what they do there comes back through the webhook.

async function pageLocale(): Promise<UiLocale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  return chosen && isUiLocale(chosen) ? chosen : 'en';
}

/** Sends the learner to Stripe Checkout for the plan the pressed button names. */
export async function startCheckout(form: FormData): Promise<void> {
  const locale = await pageLocale();
  const plans = localizePath(locale, '/study/plans');
  const user = await currentUser();
  if (!user) redirect(localizePath(locale, '/sign-in'));
  if (!isBillingConfigured()) redirect(plans);

  const plan = String(form.get('plan') ?? '');
  const countryCode = parseCountryCode(form.get('countryCode'));
  const purchase: Purchase | null =
    plan === 'pro_monthly' || plan === 'pro_yearly'
      ? { plan }
      : plan === 'country_pass' && countryCode
        ? { plan, countryCode }
        : null;
  if (!purchase) redirect(plans);
  // Never take money for something already held.
  if (purchaseProblem(await accessUser(getDb(), user.userId), purchase)) redirect(plans);

  const url = await createCheckout({
    user,
    purchase,
    locale,
    returnUrl: `${await siteOrigin()}${plans}`,
  });
  redirect(url);
}

/** Sends the learner to Stripe's portal to change their card, switch plan or cancel. */
export async function openBillingPortal(): Promise<void> {
  const locale = await pageLocale();
  const plans = localizePath(locale, '/study/plans');
  const user = await currentUser();
  if (!user) redirect(localizePath(locale, '/sign-in'));
  if (!isBillingConfigured()) redirect(plans);
  const url = await createPortal(user.userId, `${await siteOrigin()}${plans}`);
  redirect(url ?? plans);
}
