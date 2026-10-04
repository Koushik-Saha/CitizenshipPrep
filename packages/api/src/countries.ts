// Public facts about the exams Oathly covers, for the landing page and the
// globe. Everything here is safe to show signed-out visitors.

import { languageName } from '@oathly/i18n';

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

/** Everything the public page for one country's exam shows. */
export interface CountryGuide extends CountryFacts {
  topics: TopicSummary[];
}

/** A published question as the public topic page shows it, in the exam's language. */
export interface GuideQuestion {
  id: string;
  locale: string;
  text: string;
  options: { key: string; text: string }[];
  correctKeys: string[];
  explanation: string | null;
  sourceUrl: string;
  sourceQuote: string | null;
  lastVerifiedAt: string;
}

export interface TopicGuide {
  countryCode: string;
  countryName: string;
  topic: TopicSummary;
  /** Other topics of the same exam, for navigation. */
  otherTopics: TopicSummary[];
  /** A sample of the topic's published questions. */
  questions: GuideQuestion[];
}

/** URL segment for a country: its ISO code in lower case. */
export const countrySlug = (isoCode: string) => isoCode.toLowerCase();

/** "20 questions, 12 to pass, 45 minutes", leaving out what the format does not fix. */
export function describeExam(
  exam: Pick<ExamFacts, 'questionCount' | 'passMark' | 'timeLimitMinutes'>,
): string {
  const parts: string[] = [];
  if (exam.questionCount !== null) {
    parts.push(`${exam.questionCount} question${exam.questionCount === 1 ? '' : 's'}`);
  }
  if (exam.passMark !== null) parts.push(`${exam.passMark} to pass`);
  if (exam.timeLimitMinutes !== null) parts.push(`${exam.timeLimitMinutes} minutes`);
  return parts.join(', ');
}

/** "English or French" */
export function examLanguageList(languages: readonly string[], inLocale = 'en'): string {
  const names = languages.map((language) => languageName(language, inLocale));
  return new Intl.ListFormat(inLocale, { type: 'disjunction' }).format(names);
}

/**
 * Short lines about a country's exam, for the globe's hover card: the main
 * test, its language, and whether there are questions to practise yet.
 */
export function countryHighlights(country: CountryFacts): string[] {
  const lines: string[] = [];
  const exam = country.exams[0];
  if (exam) {
    const details = describeExam(exam);
    lines.push(details ? `${exam.name}: ${details}` : exam.name);
  }
  if (country.examLanguages.length > 0) {
    lines.push(`Taken in ${examLanguageList(country.examLanguages)}`);
  }
  lines.push(
    country.publishedQuestions > 0
      ? `${country.publishedQuestions} checked practice question${country.publishedQuestions === 1 ? '' : 's'}`
      : 'Practice questions being checked',
  );
  return lines;
}
