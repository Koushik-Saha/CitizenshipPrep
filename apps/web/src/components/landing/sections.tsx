// The landing page below the hero. Server Components: no client JavaScript.

import {
  countrySlug,
  describeExam,
  localCountryName,
  type CountryFacts,
  type ExamFacts,
} from '@oathly/api/countries';
import { aiLimits } from '@oathly/core';
import {
  languageList,
  studyLocales,
  type MessageKey,
  type Translator,
  localizePath,
} from '@oathly/i18n';
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
  { title: 'landing.step1Title', body: 'landing.step1Body' },
  { title: 'landing.step2Title', body: 'landing.step2Body' },
  { title: 'landing.step3Title', body: 'landing.step3Body' },
] as const satisfies { title: MessageKey; body: MessageKey }[];

export function HowItWorks({ t }: { t: Translator }) {
  return (
    <Section id="how-it-works" title={t('landing.howTitle')}>
      <ol className="grid gap-10 sm:grid-cols-3 sm:gap-8">
        {steps.map((step, i) => (
          <li key={step.title}>
            <span
              className="font-display text-accent-fg block text-5xl font-semibold tabular-nums"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <h3 className="font-display mt-3 text-xl font-medium">{t(step.title)}</h3>
            <p className="text-fg-muted mt-2">{t(step.body)}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** One exam's numbers, its official source and whether they have been checked. */
export function ExamFactsList({ exams, t }: { exams: ExamFacts[]; t: Translator }) {
  const dateFormat = new Intl.DateTimeFormat(t.locale, { dateStyle: 'medium', timeZone: 'UTC' });
  return (
    <ul className="space-y-3">
      {exams.map((exam) => (
        <li key={exam.name}>
          <p className="font-medium">{exam.name}</p>
          {describeExam(exam, t) && <p className="text-fg-muted">{describeExam(exam, t)}</p>}
          <p className="text-fg-subtle text-sm">
            <a
              href={exam.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${focusRing} rounded-xs underline underline-offset-2`}
            >
              {t('exam.officialSource')}
            </a>
            {t('exam.factSeparator')}
            {exam.lastVerifiedAt
              ? t('exam.checkedOn', { date: dateFormat.format(new Date(exam.lastVerifiedAt)) })
              : t('exam.detailsBeingChecked')}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** The covered countries as a grid; each name links to the country's page. */
export function CountryCards({
  countries,
  t,
  headingLevel: Heading = 'h3',
}: {
  countries: CountryFacts[];
  t: Translator;
  headingLevel?: 'h2' | 'h3';
}) {
  if (countries.length === 0) {
    return <p className="text-fg-muted">{t('landing.countriesEmpty')}</p>;
  }
  return (
    <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {countries.map((country) => (
        <li key={country.isoCode} className="border-border border-t pt-5">
          <Heading className="font-display flex items-center gap-2.5 text-xl font-medium">
            <span className="bg-accent size-2.5 shrink-0 rounded-full" aria-hidden="true" />
            <Link
              href={localizePath(t.locale, `/countries/${countrySlug(country.isoCode)}`)}
              className={`${focusRing} rounded-xs underline-offset-4 hover:underline`}
            >
              {localCountryName(country, t)}
            </Link>
          </Heading>
          <p className="text-fg-muted mt-1 text-sm">
            {t('exam.takenIn', { languages: languageList(country.examLanguages, t.locale) })}
          </p>
          <div className="mt-4">
            <ExamFactsList exams={country.exams} t={t} />
          </div>
          <p className="mt-4 text-sm">
            {country.publishedQuestions > 0 ? (
              t('exam.checkedQuestions', { count: country.publishedQuestions })
            ) : (
              <span className="text-fg-muted">{t('exam.questionsBeingChecked')}</span>
            )}
          </p>
          <Link
            href={localizePath(t.locale, `/sign-in?country=${country.isoCode}`)}
            className={`${focusRing} text-primary-fg mt-3 inline-block rounded-xs font-medium underline underline-offset-4`}
          >
            {t('exam.studyFor', { country: localCountryName(country, t) })}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CountryList({ countries, t }: { countries: CountryFacts[]; t: Translator }) {
  return (
    <Section
      id="countries"
      title={t('landing.countriesTitle')}
      intro={t('landing.countriesIntro')}
      className="bg-surface border-border border-y"
    >
      <CountryCards countries={countries} t={t} />
    </Section>
  );
}

const features: { title: MessageKey; body: MessageKey; soon?: boolean }[] = [
  { title: 'landing.feature1Title', body: 'landing.feature1Body' },
  { title: 'landing.feature2Title', body: 'landing.feature2Body' },
  { title: 'landing.feature3Title', body: 'landing.feature3Body' },
  { title: 'landing.feature4Title', body: 'landing.feature4Body' },
  { title: 'landing.feature5Title', body: 'landing.feature5Body' },
  { title: 'landing.feature6Title', body: 'landing.feature6Body' },
  { title: 'landing.feature7Title', body: 'landing.feature7Body', soon: true },
  { title: 'landing.feature8Title', body: 'landing.feature8Body', soon: true },
];

export function Features({ t }: { t: Translator }) {
  // Only one of these mentions a number, but passing it to all is harmless.
  const count = studyLocales.length;
  return (
    <Section id="features" title={t('landing.featuresTitle')} intro={t('landing.featuresIntro')}>
      <dl className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
        {features.map((feature) => (
          <div key={feature.title}>
            <dt className="font-display flex flex-wrap items-center gap-3 text-xl font-medium">
              {t(feature.title)}
              {feature.soon && <Badge tone="warning">{t('common.comingSoon')}</Badge>}
            </dt>
            <dd className="text-fg-muted mt-2">{t(feature.body, { count })}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function Pricing({ t }: { t: Translator }) {
  const free = aiLimits.free;
  const premium = aiLimits.premium;
  return (
    <Section
      id="pricing"
      title={t('landing.pricingTitle')}
      intro={t('landing.pricingIntro')}
      className="bg-surface border-border border-y"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="border-border-strong rounded-xl border p-6 sm:p-8">
          <h3 className="font-display text-2xl font-semibold">{t('landing.planFree')}</h3>
          <p className="text-fg-muted mt-1">{t('landing.planFreeNote')}</p>
          <ul className="mt-6 list-disc space-y-2 ps-5">
            <li>{t('landing.planFreeItem1')}</li>
            <li>{t('landing.planFreeItem2')}</li>
            <li>
              {t('landing.planAiAllowance', {
                explanations: free.explanation,
                messages: free.tutor,
              })}
            </li>
            <li>{t('landing.planFreeItem4')}</li>
          </ul>
          <Link href={localizePath(t.locale, '/sign-in')} className={`${buttonClass.primary} mt-8`}>
            {t('landing.startFree')}
          </Link>
        </div>
        <div className="border-border rounded-xl border border-dashed p-6 sm:p-8">
          <h3 className="font-display flex items-center gap-3 text-2xl font-semibold">
            {t('landing.planPremium')} <Badge tone="warning">{t('common.comingSoon')}</Badge>
          </h3>
          <p className="text-fg-muted mt-1">{t('landing.planPremiumNote')}</p>
          <ul className="mt-6 list-disc space-y-2 ps-5">
            <li>{t('landing.planPremiumItem1')}</li>
            <li>
              {t('landing.planAiAllowance', {
                explanations: premium.explanation,
                messages: premium.tutor,
              })}
            </li>
          </ul>
        </div>
      </div>
      <p className="text-fg-muted mt-6">{t('landing.planGroups')}</p>
    </Section>
  );
}

export function Testimonials({ t }: { t: Translator }) {
  return (
    <Section id="stories" title={t('landing.storiesTitle')}>
      <p className="text-fg-muted max-w-2xl text-lg">{t('landing.storiesBody')}</p>
    </Section>
  );
}

const faqs = [1, 2, 3, 4, 5, 6].map((n) => ({
  question: `landing.faq${n}Question` as MessageKey,
  answer: `landing.faq${n}Answer` as MessageKey,
}));

export function Faq({ t }: { t: Translator }) {
  const count = studyLocales.length;
  return (
    <Section id="faq" title={t('landing.faqTitle')}>
      <div className="divide-border border-border max-w-3xl divide-y border-y">
        {faqs.map((faq) => (
          <details key={faq.question} className="group">
            <summary
              className={`${focusRing} font-display flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-medium [&::-webkit-details-marker]:hidden`}
            >
              {t(faq.question)}
              <span
                className="text-fg-muted text-2xl leading-none transition-transform group-open:rotate-45 motion-reduce:transition-none"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <p className="text-fg-muted pb-6">{t(faq.answer, { count })}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
