// What the public test pages say beyond their questions: the exam's facts as
// a table, the common questions those facts answer, and the list of pages for
// the sitemap. Everything is worked out from the data, so a country with
// different facts gets a different page without anything here naming it.

import { latestDate, passPercent, type FaqItem, type SitePage } from '@oathly/core';
import { isolate, languageList, type MessageKey, type Translator } from '@oathly/i18n';

import {
  testPath,
  type ExamDetails,
  type ExamFacts,
  type TestGuide,
  type TestPages,
  type TopicGuide,
} from './countries';

const formatTypeLabel: Record<ExamFacts['formatType'], MessageKey> = {
  written: 'seo.typeWritten',
  oral: 'seo.typeOral',
  interview: 'seo.typeInterview',
  language: 'seo.typeLanguage',
};

/** One line of an exam's facts table: what it is, and its value. */
export interface ExamFactRow {
  id: 'type' | 'questions' | 'passMark' | 'time' | 'pool';
  label: string;
  value: string;
}

/** An exam's facts as label and value, leaving out what the format does not fix. */
export function examFactRows(exam: ExamDetails, t: Translator): ExamFactRow[] {
  const rows: ExamFactRow[] = [
    { id: 'type', label: t('seo.factType'), value: t(formatTypeLabel[exam.formatType]) },
  ];
  if (exam.questionCount !== null) {
    rows.push({
      id: 'questions',
      label: t('seo.factQuestions'),
      value: t('exam.questionCount', { count: exam.questionCount }),
    });
  }
  if (exam.passMark !== null) {
    const percent = passPercent(exam.passMark, exam.questionCount);
    rows.push({
      id: 'passMark',
      label: t('seo.factPassMark'),
      value:
        percent === null
          ? t('exam.toPass', { count: exam.passMark })
          : t('seo.passMarkOf', { pass: exam.passMark, count: exam.questionCount!, percent }),
    });
  }
  if (exam.timeLimitMinutes !== null) {
    rows.push({
      id: 'time',
      label: t('seo.factTime'),
      value: t('exam.minutes', { count: exam.timeLimitMinutes }),
    });
  }
  if (exam.questionPoolSize !== null) {
    rows.push({
      id: 'pool',
      label: t('seo.factPool'),
      value: t('exam.questionCount', { count: exam.questionPoolSize }),
    });
  }
  return rows;
}

/** A common question, with the official page to send the reader to where the answer has one. */
export interface FaqEntry extends FaqItem {
  link?: string;
}

/** One answer covering every exam that has the fact: a sentence each. */
const perExam = (exams: ExamDetails[], sentence: (exam: ExamDetails, name: string) => string) =>
  exams.map((exam) => sentence(exam, isolate(exam.name))).join(' ');

/** The questions an exam's numbers answer. A fact the format does not fix is not asked about. */
function examFaq(
  country: string,
  exams: ExamDetails[],
  examLanguages: string[],
  t: Translator,
): FaqEntry[] {
  const items: FaqEntry[] = [];
  const counted = exams.filter((exam) => exam.questionCount !== null);
  if (counted.length > 0) {
    items.push({
      question: t('seo.faqCountQ', { country }),
      answer: perExam(counted, (exam, name) =>
        exam.questionPoolSize === null
          ? t('seo.faqCountA', { exam: name, count: exam.questionCount! })
          : t('seo.faqCountPoolA', {
              exam: name,
              count: exam.questionCount!,
              pool: exam.questionPoolSize,
            }),
      ),
    });
  }
  const marked = exams.filter((exam) => exam.passMark !== null);
  if (marked.length > 0) {
    items.push({
      question: t('seo.faqPassQ', { country }),
      answer: perExam(marked, (exam, name) => {
        const percent = passPercent(exam.passMark, exam.questionCount);
        return percent === null
          ? t('seo.faqPassOnlyA', { exam: name, pass: exam.passMark! })
          : t('seo.faqPassA', {
              exam: name,
              pass: exam.passMark!,
              count: exam.questionCount!,
              percent,
            });
      }),
    });
  }
  const timed = exams.filter((exam) => exam.timeLimitMinutes !== null);
  if (timed.length > 0) {
    items.push({
      question: t('seo.faqTimeQ', { country }),
      answer: perExam(timed, (exam, name) =>
        t('seo.faqTimeA', { exam: name, minutes: exam.timeLimitMinutes! }),
      ),
    });
  }
  if (examLanguages.length > 0) {
    items.push({
      question: t('seo.faqLanguageQ', { country }),
      answer: t('seo.faqLanguageA', { languages: languageList(examLanguages, t.locale) }),
    });
  }
  return items;
}

/** Where the practice questions come from, and that Oathly is not the government. */
function aboutOathly(exams: ExamDetails[], hasQuestions: boolean, t: Translator): FaqEntry[] {
  const items: FaqEntry[] = [];
  if (hasQuestions) {
    items.push({ question: t('seo.faqSourceQ'), answer: t('seo.faqSourceA') });
  }
  const official = exams[0]?.sourceUrl;
  items.push({
    question: t('seo.faqOfficialQ'),
    answer: t('seo.faqOfficialA'),
    ...(official ? { link: official } : {}),
  });
  return items;
}

/** The common questions on a country's test page. `country` is its name in the reader's language. */
export function testFaq(
  guide: Pick<TestGuide, 'exams' | 'examLanguages' | 'topics' | 'publishedQuestions'>,
  country: string,
  t: Translator,
): FaqEntry[] {
  const items = examFaq(country, guide.exams, guide.examLanguages, t);
  const covered = guide.topics.filter((topic) => topic.publishedQuestions > 0);
  if (covered.length > 0) {
    items.push({
      question: t('seo.faqTopicsQ', { country }),
      answer: t('seo.faqTopicsA', {
        count: covered.length,
        topics: new Intl.ListFormat(t.locale, { type: 'conjunction' }).format(
          covered.map((topic) => isolate(topic.name)),
        ),
      }),
    });
  }
  return [...items, ...aboutOathly(guide.exams, guide.publishedQuestions > 0, t)];
}

/** The common questions on a topic's page. */
export function topicFaq(
  guide: Pick<TopicGuide, 'exams' | 'topic' | 'country'>,
  country: string,
  t: Translator,
): FaqEntry[] {
  const topic = isolate(guide.topic.name);
  return [
    {
      question: t('seo.faqTopicQ', { topic, country }),
      answer: t('seo.faqTopicA', { topic, count: guide.topic.publishedQuestions }),
    },
    ...examFaq(country, guide.exams, guide.country.examLanguages, t),
    ...aboutOathly(guide.exams, true, t),
  ];
}

/**
 * Every public page worth a search engine's visit, without a language: the
 * landing page, the country list, each country's test page and each topic's.
 * Pages behind sign-in are not here.
 */
export function publicSitePages(pages: readonly TestPages[]): SitePage[] {
  const newest = latestDate(pages.map((page) => page.lastVerifiedAt));
  return [
    { path: '/', lastModified: newest },
    { path: '/countries', lastModified: newest },
    ...pages.flatMap((page) => [
      { path: testPath(page.slug), lastModified: page.lastVerifiedAt },
      ...page.topics.map((topic) => ({
        path: testPath(page.slug, topic.slug),
        lastModified: topic.lastVerifiedAt,
      })),
    ]),
  ];
}
