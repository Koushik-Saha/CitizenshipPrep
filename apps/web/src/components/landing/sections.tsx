// The landing page below the hero. Server Components: no client JavaScript.

import {
  countrySlug,
  describeExam,
  examLanguageList,
  type CountryFacts,
  type ExamFacts,
} from '@oathly/api/countries';
import { aiLimits } from '@oathly/core';
import { studyLocales } from '@oathly/i18n';
import Link from 'next/link';

import { Badge, buttonClass, focusRing } from '@/components/ui';

function Section({
  id,
  title,
  intro,
  children,
  className = '',
}: {
  id: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={`scroll-mt-6 ${className}`}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2
          id={`${id}-heading`}
          className="font-display max-w-2xl text-3xl font-semibold sm:text-4xl"
        >
          {title}
        </h2>
        {intro && <p className="text-fg-muted mt-4 max-w-2xl text-lg">{intro}</p>}
        <div className="mt-10 sm:mt-12">{children}</div>
      </div>
    </section>
  );
}

const steps = [
  {
    title: 'Choose your country and exam',
    body: 'Tell us which test you are taking, when, and which language you would like to study in.',
  },
  {
    title: 'Practise a little each day',
    body: 'Each session mixes the topics you find hardest, questions due for review, and new ones. Wrong answers come with an explanation and the passage from the official guide.',
  },
  {
    title: 'Sit mock exams when you are close',
    body: 'Mock exams follow the real format and pass mark. Your readiness score shows how close you are, and what to study next.',
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" title="How it works">
      <ol className="grid gap-10 sm:grid-cols-3 sm:gap-8">
        {steps.map((step, i) => (
          <li key={step.title}>
            <span
              className="font-display text-accent-fg block text-5xl font-semibold tabular-nums"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <h3 className="font-display mt-3 text-xl font-medium">{step.title}</h3>
            <p className="text-fg-muted mt-2">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });

/** One exam's numbers, its official source and whether they have been checked. */
export function ExamFactsList({ exams }: { exams: ExamFacts[] }) {
  return (
    <ul className="space-y-3">
      {exams.map((exam) => (
        <li key={exam.name}>
          <p className="font-medium">{exam.name}</p>
          {describeExam(exam) && <p className="text-fg-muted">{describeExam(exam)}</p>}
          <p className="text-fg-subtle text-sm">
            <a
              href={exam.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${focusRing} rounded-xs underline underline-offset-2`}
            >
              Official source
            </a>
            {exam.lastVerifiedAt
              ? `, checked ${dateFormat.format(new Date(exam.lastVerifiedAt))}`
              : ', details being checked'}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** The covered countries as a grid; each name links to the country's page. */
export function CountryCards({
  countries,
  headingLevel: Heading = 'h3',
}: {
  countries: CountryFacts[];
  headingLevel?: 'h2' | 'h3';
}) {
  if (countries.length === 0) {
    return <p className="text-fg-muted">The country list is being updated. Check back shortly.</p>;
  }
  return (
    <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {countries.map((country) => (
        <li key={country.isoCode} className="border-border border-t pt-5">
          <Heading className="font-display flex items-center gap-2.5 text-xl font-medium">
            <span className="bg-accent size-2.5 shrink-0 rounded-full" aria-hidden="true" />
            <Link
              href={`/countries/${countrySlug(country.isoCode)}`}
              className={`${focusRing} rounded-xs underline-offset-4 hover:underline`}
            >
              {country.name}
            </Link>
          </Heading>
          <p className="text-fg-muted mt-1 text-sm">
            Taken in {examLanguageList(country.examLanguages)}
          </p>
          <div className="mt-4">
            <ExamFactsList exams={country.exams} />
          </div>
          <p className="mt-4 text-sm">
            {country.publishedQuestions > 0 ? (
              `${country.publishedQuestions} checked practice questions`
            ) : (
              <span className="text-fg-muted">Practice questions are being checked</span>
            )}
          </p>
          <Link
            href={`/sign-in?country=${country.isoCode}`}
            className={`${focusRing} text-primary-fg mt-3 inline-block rounded-xs font-medium underline underline-offset-4`}
          >
            Study for {country.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CountryList({ countries }: { countries: CountryFacts[] }) {
  return (
    <Section
      id="countries"
      title="Countries and exams"
      intro="We add a country once its exam format and study material have been checked against official sources. More are on the way."
      className="bg-surface border-border border-y"
    >
      <CountryCards countries={countries} />
    </Section>
  );
}

const features: { title: string; body: string; soon?: boolean }[] = [
  {
    title: 'Every country’s test, one app',
    body: 'Preparing for more than one country’s test? Study for each in the same account, with progress kept separately.',
  },
  {
    title: 'Checked against the official source',
    body: 'Every question links to the page of the official guide it comes from and shows when it was last checked. A person approves each one before you see it.',
  },
  {
    title: 'Answers explained',
    body: 'Ask why an answer is right and get a short explanation built from the official guide, or ask the tutor follow-up questions.',
  },
  {
    title: 'Practice that adapts to you',
    body: 'Sessions focus on your weakest topics and bring questions back just before you would forget them.',
  },
  {
    title: 'A readiness score you can trust',
    body: 'An estimate weighted the way the real exam is, which drops if you stop studying. It tells you what to work on, not just a number.',
  },
  {
    title: 'Study in your own language',
    body: `Choose from ${studyLocales.length} languages. Questions switch to the exam’s language where a checked translation is not ready yet.`,
  },
  {
    title: 'Study groups',
    body: 'Prepare alongside people taking the same test.',
    soon: true,
  },
  {
    title: 'For schools and organisations',
    body: 'Classes and settlement services will be able to track how their learners are doing.',
    soon: true,
  },
];

export function Features() {
  return (
    <Section
      id="features"
      title="Built for the test you are actually taking"
      intro="Most citizenship apps cover one country with a fixed question list. Oathly is built around official sources and how people really learn."
    >
      <dl className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
        {features.map((feature) => (
          <div key={feature.title}>
            <dt className="font-display flex flex-wrap items-center gap-3 text-xl font-medium">
              {feature.title}
              {feature.soon && <Badge tone="warning">Coming soon</Badge>}
            </dt>
            <dd className="text-fg-muted mt-2">{feature.body}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function Pricing() {
  const free = aiLimits.free;
  const premium = aiLimits.premium;
  return (
    <Section
      id="pricing"
      title="Pricing"
      intro="Studying is free. A paid plan will add more AI help for people who use a lot of it."
      className="bg-surface border-border border-y"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="border-border-strong rounded-xl border p-6 sm:p-8">
          <h3 className="font-display text-2xl font-semibold">Free</h3>
          <p className="text-fg-muted mt-1">No card needed.</p>
          <ul className="mt-6 list-disc space-y-2 pl-5">
            <li>Unlimited practice, flashcards and mock exams</li>
            <li>Readiness score and study suggestions</li>
            <li>
              {free.explanation} answer explanations and {free.tutor} tutor messages a day
            </li>
            <li>Every country and study language</li>
          </ul>
          <Link href="/sign-in" className={`${buttonClass.primary} mt-8`}>
            Start studying free
          </Link>
        </div>
        <div className="border-border rounded-xl border border-dashed p-6 sm:p-8">
          <h3 className="font-display flex items-center gap-3 text-2xl font-semibold">
            Premium <Badge tone="warning">Coming soon</Badge>
          </h3>
          <p className="text-fg-muted mt-1">Price to be announced.</p>
          <ul className="mt-6 list-disc space-y-2 pl-5">
            <li>Everything in Free</li>
            <li>
              {premium.explanation} answer explanations and {premium.tutor} tutor messages a day
            </li>
          </ul>
        </div>
      </div>
      <p className="text-fg-muted mt-6">
        Schools, libraries and settlement services: plans for groups are coming soon.
      </p>
    </Section>
  );
}

export function Testimonials() {
  return (
    <Section id="stories" title="What learners say">
      <p className="text-fg-muted max-w-2xl text-lg">
        Oathly is new, so there are no reviews yet. Once learners who studied here have taken their
        tests, their words will go here. Only real ones, with their permission.
      </p>
    </Section>
  );
}

const faqs: { question: string; answer: React.ReactNode }[] = [
  {
    question: 'Is Oathly an official government app?',
    answer:
      'No. Oathly is independent and is not affiliated with, or endorsed by, any government. To book your test or check the rules that apply to you, use your government’s official website.',
  },
  {
    question: 'Are these the real exam questions?',
    answer:
      'Some countries publish the exact questions they ask; others publish a study guide and keep the questions private. Either way, every Oathly question is written from the official material, links to the page it comes from, and is checked by a person before you see it.',
  },
  {
    question: 'How accurate is the readiness score?',
    answer:
      'It is an estimate, not a prediction of your result. It is based on how well you know each topic, weighted the way your exam is, and on your recent mock exams. It goes down if you stop studying, because you forget.',
  },
  {
    question: 'Can I study in my own language?',
    answer: `Yes. You can choose from ${studyLocales.length} languages. Translations are checked before they appear; until then you see the question in the exam’s language. The exam itself is taken in the language your country sets.`,
  },
  {
    question: 'What does it cost?',
    answer:
      'Practice, flashcards, mock exams and the readiness score are free. A paid plan with more AI explanations and tutor messages is coming; its price is not set yet.',
  },
  {
    question: 'My country is not listed. Will you add it?',
    answer:
      'We are working towards every country that has a citizenship test. We add each one once its exam format and study material have been checked against official sources.',
  },
];

export function Faq() {
  return (
    <Section id="faq" title="Questions">
      <div className="divide-border border-border max-w-3xl divide-y border-y">
        {faqs.map((faq) => (
          <details key={faq.question} className="group">
            <summary
              className={`${focusRing} font-display flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-medium [&::-webkit-details-marker]:hidden`}
            >
              {faq.question}
              <span
                className="text-fg-muted text-2xl leading-none transition-transform group-open:rotate-45 motion-reduce:transition-none"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <p className="text-fg-muted pb-6">{faq.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
