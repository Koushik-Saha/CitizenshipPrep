import { localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Contact, LegalPage, legalLink, List, Section } from '@/components/legal/legal-page';
import { getT } from '@/lib/i18n';
import { operator } from '@/lib/legal';

const title = 'Privacy policy';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${title} | Oathly`,
    description:
      'What Oathly knows about you, why, who else handles it, how long it is kept, and how to see, correct or delete it.',
    // One text, in English, whichever language's address it is read at.
    alternates: { canonical: '/privacy' },
  };
}

// What Oathly collects and why. Keep it true: when the app starts collecting
// something new, or sending it somewhere new, this page changes with it (and
// LEGAL_UPDATED in lib/legal.ts).
export default async function PrivacyPage({ params }: PageProps<'/[locale]/privacy'>) {
  const { locale, t } = await getT(params);
  const who = operator();
  return (
    <LegalPage t={t} path="/privacy" title={title}>
      <p>
        Oathly is a study app for citizenship tests. It is independent: it is not run by, or
        connected to, any government. This page says what the app knows about you, why, who else
        handles it, and what you can do about it.
      </p>

      <Section title="Who is responsible">
        <p>The service is run by:</p>
        <Contact operator={who} />
        <p>Privacy questions and requests go to the same address.</p>
      </Section>

      <Section title="What we collect">
        <List>
          <li>
            <strong>Your account.</strong> Your email address, and your name if you give one or sign
            in with Google. Signing in is handled by our sign-in provider (see below).
          </li>
          <li>
            <strong>Your study plan.</strong> The countries you are studying for, your exam date if
            you set one, the language you study in, your daily goal, your time zone, and, if you
            tell us, whether you passed.
          </li>
          <li>
            <strong>Your study.</strong> The questions you were asked, what you answered, whether it
            was right and how long it took, your mock exams, and the readiness estimate worked out
            from them.
          </li>
          <li>
            <strong>Questions you ask the tutor.</strong> What you type to the AI tutor, and the
            explanations you ask for. Do not put anything personal in them.
          </li>
          <li>
            <strong>Purchases.</strong> Which plan you hold, when it renews or ends, and the
            reference our payment provider or your phone&apos;s store gives us for it. We never see
            or store your card details.
          </li>
          <li>
            <strong>Organizations.</strong> If a school, law firm or other organization invites you
            and you accept, the email address they invited, the name they know you by, and the
            country and date they set for you.
          </li>
          <li>
            <strong>Technical records.</strong> Error reports when the app fails (the error and
            where it happened, not what you were typing), and a count of requests per account or per
            network address, kept under a one-way hash for a day, to stop abuse.
          </li>
        </List>
        <p>
          We do not collect your location, your contacts or your photos. Speaking an answer aloud
          uses your device&apos;s own speech recognition, which may send the audio to Apple or
          Google under their terms; Oathly receives only the resulting text and does not keep the
          audio.
        </p>
      </Section>

      <Section title="Why we use it">
        <List>
          <li>
            To run the service you asked for: keeping your progress, choosing what to ask you next,
            estimating your readiness, and making it available on your other devices.
          </li>
          <li>To take payment for a plan and give you what it includes.</li>
          <li>
            To count how the product is used, in aggregate: sign-ups, first questions answered, mock
            exams finished, plans bought, exams passed. These are recorded against your account
            number, not your name or email.
          </li>
          <li>To find and fix faults, and to protect the service against abuse.</li>
        </List>
        <p>
          We do not sell your data, show advertising, or use your data to train AI models. Where the
          law asks for a legal basis: running the service is the performance of our contract with
          you; counting usage, fixing faults and preventing abuse are our legitimate interests.
        </p>
      </Section>

      <Section title="What an organization can see">
        <p>
          If you join an organization, its administrators can see your readiness estimate, when you
          last studied, how much you studied, and your mock exam results, for the country they
          assigned you (or your main one, if they assigned none). They cannot see your individual
          answers, what you ask the tutor, or anything about other countries you study. Other
          members cannot see you at all. You can leave an organization at any time from the
          Organizations page.
        </p>
      </Section>

      <Section title="Who else handles it">
        <p>These companies process data for us, under contract, to provide the service:</p>
        <List>
          <li>Neon: the database, and signing in (including sign-in emails).</li>
          <li>Vercel: hosting the website and the service behind the apps.</li>
          <li>
            Anthropic: writing AI explanations and tutor replies. It receives the question and what
            you asked, not who you are.
          </li>
          <li>Stripe: payments made on the website.</li>
          <li>Apple, Google and RevenueCat: purchases made in the phone apps.</li>
          <li>Resend: invitation emails sent on behalf of organizations.</li>
          <li>Sentry: error reports.</li>
          <li>PostHog: usage counts.</li>
        </List>
        <p>
          Some of them are outside the country you live in, including in the United States. Where
          the law requires safeguards for such transfers, we rely on the contractual terms these
          providers offer for that purpose.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          For as long as you have an account. When you delete your account, your profile, study
          plan, answers, progress, memberships and purchase records here are deleted at once.
          Backups that still hold them expire within 30 days. Our payment providers keep their own
          records of payments for as long as tax and accounting law requires. Error reports are kept
          for up to 90 days.
        </p>
      </Section>

      <Section title="Your choices">
        <List>
          <li>
            <strong>Delete your account</strong> yourself, in the app or on the website:{' '}
            <Link href={localizePath(locale, '/delete-account')} className={legalLink}>
              how to delete your account
            </Link>
            .
          </li>
          <li>
            <strong>See or correct</strong> what we hold: most of it is on your dashboard; write to
            us for a copy of the rest, or to have something corrected.
          </li>
          <li>
            <strong>Object or complain.</strong> You can ask us to stop a use of your data, and you
            have the right to complain to the data protection authority where you live.
          </li>
        </List>
      </Section>

      <Section title="Cookies">
        <p>
          The website sets only the cookies it needs to work: the ones that keep you signed in, and
          one that remembers the language you chose. There are no advertising or tracking cookies.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Oathly is for people preparing for a citizenship test and is not directed at children
          under 16. If you believe a child has given us personal data, write to us and we will
          delete it.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          When this policy changes, the date at the top changes with it. If a change affects how we
          use data you have already given us, we will tell you in the app before it takes effect.
        </p>
      </Section>
    </LegalPage>
  );
}
