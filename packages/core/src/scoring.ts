import type { MockExam } from './mock-exam';
import type { Answer, QuizQuestion } from './types';

/** Whether the selected option keys answer the question correctly. */
export function isCorrect(question: QuizQuestion, selectedKeys: readonly string[]): boolean {
  const selected = new Set(selectedKeys);
  if (question.type === 'free_response') {
    // The options are the accepted answers; the learner picks the one they gave.
    return question.correctKeys.some((key) => selected.has(key));
  }
  return (
    selected.size === question.correctKeys.length &&
    question.correctKeys.every((key) => selected.has(key))
  );
}

export interface TopicScore {
  total: number;
  answered: number;
  correct: number;
}

export interface SectionResult {
  id: string;
  label: string;
  total: number;
  correct: number;
  /** False only for a section where every answer must be right, and one was not. */
  passed: boolean;
}

export interface ExamResult {
  passed: boolean;
  /** Plain-language reasons the attempt failed; empty when it passed. */
  reasons: string[];
  sections: SectionResult[];
  /** True when the time ran out; answers given after it do not count. */
  timedOut: boolean;
}

export interface AttemptScore {
  total: number;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  /** Correct answers as a share of all questions, 0 to 100. */
  percent: number;
  byTopic: Record<string, TopicScore>;
  /** Present when the attempt was a mock exam. */
  exam?: ExamResult;
}

export interface ScoreOptions {
  exam?: MockExam;
  /** When the exam started, for the time limit. */
  startedAt?: Date;
}

/** The answer that counts for each question: the last one given before time ran out. */
function countedAnswers(answers: readonly Answer[], deadline: number | null): Map<string, Answer> {
  const counted = new Map<string, Answer>();
  for (const answer of [...answers].sort(
    (a, b) => a.answeredAt.getTime() - b.answeredAt.getTime(),
  )) {
    if (deadline !== null && answer.answeredAt.getTime() > deadline) continue;
    counted.set(answer.questionId, answer);
  }
  return counted;
}

function deadlineFor(options: ScoreOptions): number | null {
  const limit = options.exam?.timeLimitMs;
  if (limit == null) return null;
  if (!options.startedAt) throw new Error('A timed exam needs the time it started.');
  return options.startedAt.getTime() + limit;
}

export function scoreAttempt(
  questions: readonly QuizQuestion[],
  answers: readonly Answer[],
  options: ScoreOptions = {},
): AttemptScore {
  const deadline = deadlineFor(options);
  const counted = countedAnswers(answers, deadline);
  const correctIds = new Set<string>();
  const byTopic: Record<string, TopicScore> = {};
  let answered = 0;

  for (const question of questions) {
    const topic = (byTopic[question.topicId] ??= { total: 0, answered: 0, correct: 0 });
    topic.total += 1;
    const answer = counted.get(question.id);
    if (!answer) continue;
    answered += 1;
    topic.answered += 1;
    if (isCorrect(question, answer.selectedKeys)) {
      correctIds.add(question.id);
      topic.correct += 1;
    }
  }

  const total = questions.length;
  const correct = correctIds.size;
  const score: AttemptScore = {
    total,
    answered,
    correct,
    incorrect: answered - correct,
    unanswered: total - answered,
    percent: total === 0 ? 0 : Math.round((correct / total) * 1000) / 10,
    byTopic,
  };

  if (options.exam) {
    const exam = options.exam;
    const sections = exam.sections.map((section) => {
      const sectionCorrect = section.questionIds.filter((id) => correctIds.has(id)).length;
      return {
        id: section.id,
        label: section.label,
        total: section.questionIds.length,
        correct: sectionCorrect,
        passed: !section.mustAllBeCorrect || sectionCorrect === section.questionIds.length,
      };
    });
    const reasons: string[] = [];
    if (exam.passMark !== null && correct < exam.passMark) {
      reasons.push(
        `${correct} of ${exam.questionCount} correct; ${exam.passMark} are needed to pass.`,
      );
    }
    for (const section of sections) {
      if (!section.passed) {
        reasons.push(
          `Every "${section.label}" question must be correct; ${section.correct} of ${section.total} were.`,
        );
      }
    }
    const lastAnswer = Math.max(...answers.map((answer) => answer.answeredAt.getTime()), -Infinity);
    score.exam = {
      passed: reasons.length === 0,
      reasons,
      sections,
      timedOut: deadline !== null && lastAnswer > deadline,
    };
  }
  return score;
}

/**
 * For exams where the examiner stops once the result is certain: 'passed'
 * when the pass mark is reached and no all-correct section has been failed,
 * 'failed' once passing is no longer possible, otherwise null (keep asking).
 */
export function examDecision(
  exam: MockExam,
  questions: readonly QuizQuestion[],
  answers: readonly Answer[],
): 'passed' | 'failed' | null {
  if (exam.passMark === null) return null;
  const byId = new Map(questions.map((question) => [question.id, question]));
  const counted = countedAnswers(answers, null);
  const correct = new Set(
    [...counted.values()]
      .filter((answer) => {
        const question = byId.get(answer.questionId);
        return question !== undefined && isCorrect(question, answer.selectedKeys);
      })
      .map((answer) => answer.questionId),
  );
  const wrong = [...counted.keys()].filter((id) => byId.has(id) && !correct.has(id));

  const strictIds = new Set(
    exam.sections
      .filter((section) => section.mustAllBeCorrect)
      .flatMap((section) => section.questionIds),
  );
  if (wrong.some((id) => strictIds.has(id))) return 'failed';
  if (wrong.length > exam.questionCount - exam.passMark) return 'failed';
  const strictPending = [...strictIds].some((id) => !correct.has(id));
  if (correct.size >= exam.passMark && !strictPending) return 'passed';
  return null;
}
