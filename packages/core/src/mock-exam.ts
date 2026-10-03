import { examSections, type ExamFormat, type ExamSection } from './exam-format';
import { shuffle, type Random } from './random';
import type { QuizQuestion } from './types';

export interface MockExamSection {
  id: string;
  label: string;
  questionIds: string[];
  mustAllBeCorrect: boolean;
}

export interface MockExam {
  formatId: string;
  /** In the order they are asked. */
  questionIds: string[];
  sections: MockExamSection[];
  questionCount: number;
  passMark: number | null;
  timeLimitMs: number | null;
  stopEarly: boolean;
}

export class MockExamError extends Error {
  override readonly name = 'MockExamError';
}

export interface MockExamOptions {
  random: Random;
  /** The learner's region, for formats with regional questions. */
  region?: string | null;
}

function matches(question: QuizQuestion, section: ExamSection, region: string | null): boolean {
  const { topics, excludeTopics, regional } = section.source;
  if (regional) {
    if (!region || question.regionCode !== region) return false;
  } else if (question.regionCode !== null) {
    return false;
  }
  if (topics && !topics.includes(question.topicSlug)) return false;
  if (excludeTopics?.includes(question.topicSlug)) return false;
  return true;
}

/**
 * A mock exam in the shape of the real one: the same number of questions,
 * drawn per section the way the real exam draws them, with its time limit and
 * pass mark. Throws when the pool cannot fill it.
 */
export function buildMockExam(
  format: ExamFormat,
  pool: readonly QuizQuestion[],
  options: MockExamOptions,
): MockExam {
  const region = options.region ?? null;
  const used = new Set<string>();
  const sections: MockExamSection[] = [];

  for (const section of examSections(format)) {
    if (section.source.regional && !region) {
      throw new MockExamError(`"${section.label}" needs the learner's region.`);
    }
    const candidates = pool.filter(
      (question) => !used.has(question.id) && matches(question, section, region),
    );
    if (candidates.length < section.count) {
      throw new MockExamError(
        `"${section.label}" needs ${section.count} questions but only ${candidates.length} are available.`,
      );
    }
    const chosen = shuffle(candidates, options.random).slice(0, section.count);
    for (const question of chosen) used.add(question.id);
    sections.push({
      id: section.id,
      label: section.label,
      questionIds: chosen.map((question) => question.id),
      mustAllBeCorrect: section.mustAllBeCorrect,
    });
  }

  return {
    formatId: format.id,
    // Real exams mix the sections rather than asking them in blocks.
    questionIds: shuffle(
      sections.flatMap((section) => section.questionIds),
      options.random,
    ),
    sections,
    questionCount: format.questionCount!,
    passMark: format.passMark,
    timeLimitMs: format.timeLimitMinutes == null ? null : format.timeLimitMinutes * 60_000,
    stopEarly: format.blueprint.stopEarly,
  };
}
