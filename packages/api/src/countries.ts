// Public facts about the exams Oathly covers, for the landing page and the
// globe. Everything here is safe to show signed-out visitors.

import { countryName, languageList, type Translator } from '@oathly/i18n';

export { parseCountryCode, searchCountries } from './country-search';

export interface ExamFacts {
  name: string;
  formatType: 'written' | 'oral' | 'interview' | 'language';
  questionCount: number | null;
  passMark: number | null;
  timeLimitMinutes: number | null;
  /** The official page these facts come from. */
  sourceUrl: string;
  /** When someone last checked them against that page; null until they have. */
  lastVerifiedAt: string | null;
}

export interface CountryFacts {
  isoCode: string;
  /** The country in a public address: "united-states". */
  slug: string;
  name: string;
  examLanguages: string[];
  /** A point inside the country for the globe; null when not set. */
  latitude: number | null;
  longitude: number | null;
  /** Current exam formats, written test first. */
  exams: ExamFacts[];
  /** Verified, published questions learners can practise. */
  publishedQuestions: number;
}

export interface TopicSummary {
  slug: string;
  name: string;
  publishedQuestions: number;
}

/** An exam format with everything the country's public page says about it. */
export interface ExamDetails extends ExamFacts {
  /** How many questions the test's are drawn from, where the source says. */
  questionPoolSize: number | null;
  /** Rules the numbers cannot express, as the source words them. */
  notes: string | null;
}

/** One wording of a question: the exam's own, or a reviewed translation. */
export interface GuideWording {
  locale: string;
  text: string;
  options: { key: string; text: string }[];
}

/** A published question as a public page shows it. */
export interface GuideQuestion extends GuideWording {
  id: string;
  topic: { slug: string; name: string };
  correctKeys: string[];
  explanation: string | null;
  /** The exam's own wording, when the question is shown in translation. */
  original: GuideWording | null;
  sourceUrl: string;
  sourceQuote: string | null;
  lastVerifiedAt: string;
}

/** Everything the public page for one country's test shows. */
export interface TestGuide extends Omit<CountryFacts, 'exams' | 'latitude' | 'longitude'> {
  exams: ExamDetails[];
  topics: TopicSummary[];
  /** A sample of the published questions, spread across the topics. */
  questions: GuideQuestion[];
  /** When a fact or question on the page was last checked against its source. */
  lastVerifiedAt: string | null;
}

/** Everything the public page for one topic of a country's test shows. */
export interface TopicGuide {
  country: Pick<CountryFacts, 'isoCode' | 'slug' | 'name' | 'examLanguages'>;
  exams: ExamDetails[];
  topic: TopicSummary;
  /** The exam's other topics that have a page, for navigation. */
  otherTopics: TopicSummary[];
  /** A sample of the topic's published questions. */
  questions: GuideQuestion[];
  /** When a question in the topic was last checked against its source. */
  lastVerifiedAt: string | null;
}

/** A country's public pages: its own and one per topic with published questions. */
export interface TestPages {
  isoCode: string;
  slug: string;
  lastVerifiedAt: string | null;
  topics: { slug: string; lastVerifiedAt: string | null }[];
}

/** The public page for a country's test, and for one of its topics, without a language prefix. */
export const testPath = (countrySlug: string, topicSlug?: string) =>
  `/${countrySlug}/citizenship-test${topicSlug ? `/${topicSlug}` : ''}`;

/** "20 questions, 12 to pass, 45 minutes", leaving out what the format does not fix. */
export function describeExam(
  exam: Pick<ExamFacts, 'questionCount' | 'passMark' | 'timeLimitMinutes'>,
  t: Translator,
): string {
  const parts: string[] = [];
  if (exam.questionCount !== null)
    parts.push(t('exam.questionCount', { count: exam.questionCount }));
  if (exam.passMark !== null) parts.push(t('exam.toPass', { count: exam.passMark }));
  if (exam.timeLimitMinutes !== null)
    parts.push(t('exam.minutes', { count: exam.timeLimitMinutes }));
  return parts.join(t('exam.factSeparator'));
}

/** A country's name in the reader's language. */
export function localCountryName(
  country: { isoCode: string; name: string },
  t: Translator,
): string {
  return countryName(country.isoCode, t.locale, country.name);
}

/**
 * Short lines about a country's exam, for the globe's hover card: the main
 * test, its language, and whether there are questions to practise yet.
 */
export function countryHighlights(country: CountryFacts, t: Translator): string[] {
  const lines: string[] = [];
  const exam = country.exams[0];
  if (exam) {
    const details = describeExam(exam, t);
    lines.push(details ? `${exam.name}: ${details}` : exam.name);
  }
  if (country.examLanguages.length > 0) {
    lines.push(t('exam.takenIn', { languages: languageList(country.examLanguages, t.locale) }));
  }
  lines.push(
    country.publishedQuestions > 0
      ? t('exam.checkedQuestions', { count: country.publishedQuestions })
      : t('exam.questionsBeingChecked'),
  );
  return lines;
}
