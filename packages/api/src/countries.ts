// Public facts about the exams Oathly covers, for the landing page and the
// globe. Everything here is safe to show signed-out visitors.

import { parseBlueprint } from '@oathly/core';
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
  /**
   * Parts of the exam where every question must be right, besides the pass
   * mark (Australia: all 5 on Australian values). Optional on the way in: a
   * copy saved before this existed still reads.
   */
  allCorrect?: { label: string; count: number }[];
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
  /**
   * Its questions are complete (isCountryComplete in packages/core). While
   * not, the country is shown as Beta and its Country Pass is not sold.
   */
  complete: boolean;
}

/**
 * The countries to list in public: those with at least one published
 * question. A country whose questions are all still being checked has nothing
 * to practise, so it stays off the lists until its first one is published.
 */
export function countriesWithQuestions<T extends Pick<CountryFacts, 'publishedQuestions'>>(
  countries: readonly T[],
): T[] {
  return countries.filter((country) => country.publishedQuestions > 0);
}

/**
 * The official question pool a country has not covered yet: the largest
 * published pool among its exams, when it has fewer published questions than
 * that. Null where no pool is public, or the bank covers it. The country's
 * page then says "67 of the 310 questions in the official pool so far", so
 * nobody takes a partial bank for the whole one.
 */
export function uncoveredPool(
  publishedQuestions: number,
  exams: readonly { questionPoolSize: number | null }[],
): number | null {
  const pool = Math.max(0, ...exams.map((exam) => exam.questionPoolSize ?? 0));
  return pool > 0 && publishedQuestions < pool ? pool : null;
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

/**
 * The parts of an exam whose every question must be right, from its stored
 * blueprint. Empty where there are none, or the blueprint cannot be read.
 */
export function allCorrectSections(blueprint: unknown): { label: string; count: number }[] {
  try {
    return (parseBlueprint(blueprint).sections ?? [])
      .filter((section) => section.mustAllBeCorrect)
      .map((section) => ({ label: section.label, count: section.count }));
  } catch {
    return [];
  }
}

/** Each such part as a sentence: "All 5 questions on “Australian values” must be correct." */
export function describeAllCorrect(exam: Pick<ExamFacts, 'allCorrect'>, t: Translator): string[] {
  return (exam.allCorrect ?? []).map((section) =>
    t('exam.allMustBeCorrect', { count: section.count, section: section.label }),
  );
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
