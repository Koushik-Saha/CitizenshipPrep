import { localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Contact, LegalPage, legalLink, List, Section } from '@/components/legal/legal-page';
import { getT } from '@/lib/i18n';
import { operator } from '@/lib/legal';

const title = 'Delete your Oathly account';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${title} | Oathly`,
    description:
      'How to delete your Oathly account and your data, in the app or on the website, and what is removed.',
    alternates: { canonical: '/delete-account' },
  };
}

// How to delete an account, for anyone to read without signing in. The app
// stores ask for a public address that says this; it is also where the
// privacy policy and the terms point.
export default async function DeleteAccountPage({ params }: PageProps<'/[locale]/delete-account'>) {
  const { locale, t } = await getT(params);
  const who = operator();
  return (
    <LegalPage t={t} path="/delete-account" title={title} dated={false}>
      <p>
        You can delete your Oathly account, and everything in it, yourself at any time. It takes
        effect at once and cannot be undone.
      </p>

      <Section title="In the phone app">
        <ol className="list-decimal space-y-2 ps-6">
          <li>Open the Profile tab.</li>
          <li>
            Choose <strong>Delete your account</strong> at the bottom.
          </li>
          <li>
            Read what will be removed, confirm, and choose <strong>Delete my account</strong>.
          </li>
        </ol>
      </Section>

      <Section title="On the website">
        <ol className="list-decimal space-y-2 ps-6">
          <li>
            <Link href={localizePath(locale, '/sign-in')} className={legalLink}>
              Sign in
            </Link>
            .
          </li>
          <li>
            Open{' '}
            <Link href={localizePath(locale, '/study/account')} className={legalLink}>
              Account
            </Link>{' '}
            from your study page.
          </li>
          <li>
            Under <strong>Delete your account</strong>, confirm and choose{' '}
            <strong>Delete my account</strong>.
          </li>
        </ol>
      </Section>

      <Section title="What is deleted">
        <List>
          <li>Your profile and your sign-in account.</li>
          <li>Your study plan, exam dates and settings.</li>
          <li>Every answer you gave, your sessions, mock exams, progress and readiness.</li>
          <li>Your memberships of organizations, and an organization you own if it is empty.</li>
          <li>The record here of what you bought.</li>
        </List>
      </Section>

      <Section title="What is not, and what to do first">
        <List>
          <li>
            <strong>
              A subscription bought in the App Store or on Google Play is not cancelled
            </strong>{' '}
            by deleting your account: only you can cancel it, in your phone&apos;s subscription
            settings. Do that first, or you will keep being charged. A subscription bought on the
            website is cancelled for you.
          </li>
          <li>
            Our payment providers keep their own records of payments for as long as tax and
            accounting law requires.
          </li>
          <li>Backups that still hold your data expire within 30 days.</li>
          <li>
            If you own an organization that has members or paid seats, remove them first, or write
            to us to hand it to someone else.
          </li>
        </List>
      </Section>

      <Section title="If you cannot sign in">
        <p>
          Write to us from the email address of the account and we will delete it for you within 30
          days:
        </p>
        <Contact operator={who} />
      </Section>
    </LegalPage>
  );
}
