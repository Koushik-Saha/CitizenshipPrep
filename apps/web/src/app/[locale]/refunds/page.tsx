import { localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Contact, LegalPage, legalLink, List, Section } from '@/components/legal/legal-page';
import { getT } from '@/lib/i18n';
import { operator } from '@/lib/legal';

const title = 'Refunds and cancelling';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${title} | Swornly`,
    description:
      'How to cancel an Swornly plan, when a payment is refunded, who to ask, and what happens to your access.',
    alternates: { canonical: '/refunds' },
  };
}

// Who refunds what, how to ask, and what cancelling does. It says what the
// terms say and what the service does (see lib/billing.ts and the Stripe
// webhook), in one place a buyer, a payment provider or an app store can be
// pointed to. It promises nothing the terms do not.
export default async function RefundsPage({ params }: PageProps<'/[locale]/refunds'>) {
  const { locale, t } = await getT(params);
  const who = operator();
  return (
    <LegalPage t={t} path="/refunds" title={title}>
      <p>
        This page explains how to cancel a plan and how refunds work. It is part of the{' '}
        <Link href={localizePath(locale, '/terms')} className={legalLink}>
          terms
        </Link>
        .
      </p>

      <Section title="Cancelling Pro">
        <List>
          <li>
            You can cancel at any time. Bought on the website: open{' '}
            <Link href={localizePath(locale, '/study/plans')} className={legalLink}>
              Plans
            </Link>{' '}
            and choose <strong>Cancel plan</strong>. Bought in a phone app: cancel in your
            phone&apos;s subscription settings (App Store or Google Play).
          </li>
          <li>
            Cancelling stops the next renewal. You keep Pro until the end of the period you have
            already paid for, and you are not charged again.
          </li>
          <li>
            Cancelling does not by itself refund the period you are in. If you want a refund as
            well, ask as described below.
          </li>
        </List>
      </Section>

      <Section title="Refunds for purchases on the website">
        <List>
          <li>
            Write to us at the address below from the email address on your account, and say which
            purchase it is. We reply by email.
          </li>
          <li>
            Where the law gives you a right to withdraw from a purchase or to a refund, you have it,
            and these terms do not take it away. In the European Union and the United Kingdom, a
            consumer can normally withdraw from an online purchase within 14 days. At checkout you
            ask for access to start at once, and for digital content that can end the right to
            withdraw once access has begun; where it has not ended, we refund on request.
          </li>
          <li>
            If you were charged by mistake, charged twice, or could not use what you paid for
            because of a fault of ours, tell us and we will put it right, including by refund.
          </li>
          <li>
            A refund goes back to the card or account that paid. Our payment provider, Stripe, sends
            it; your bank usually shows it within 5 to 10 working days.
          </li>
          <li>
            When a payment is refunded, what it bought ends: Pro stops, or the Country Pass is
            removed, and your account returns to the Free plan. Your progress is kept.
          </li>
        </List>
      </Section>

      <Section title="Refunds for purchases in a phone app">
        <p>
          Apple and Google take the payment for purchases made in the apps, and they decide and make
          refunds. We cannot refund those purchases ourselves.
        </p>
        <List>
          <li>
            App Store: ask at{' '}
            <a href="https://reportaproblem.apple.com" className={legalLink} rel="noreferrer">
              reportaproblem.apple.com
            </a>
            .
          </li>
          <li>
            Google Play: ask in the Play Store under your order history, or at{' '}
            <a
              href="https://support.google.com/googleplay/answer/2479637"
              className={legalLink}
              rel="noreferrer"
            >
              Google Play&apos;s refund help
            </a>
            .
          </li>
        </List>
      </Section>

      <Section title="Organizations">
        <p>
          Seats bought by an organization are managed by its admins from the organization&apos;s
          billing page. The same rules apply: cancelling stops the next renewal, and refunds are
          asked for at the address below.
        </p>
      </Section>

      <Section title="Contact">
        <p>Questions about a payment or a refund go to:</p>
        <Contact operator={who} />
      </Section>
    </LegalPage>
  );
}
