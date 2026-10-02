import {
  getQueueCounts,
  listQuestionQueue,
  listReviewCountries,
  listTranslationQueue,
} from '@oathly/content/review';
import Link from 'next/link';

import {
  Badge,
  buttonClass,
  fieldClass,
  focusRing,
  Notice,
  StatusBadge,
} from '@/components/admin/ui';
import { getDb, requireReviewer } from '@/lib/admin';

const views = ['questions', 'translations', 'source'] as const;
type View = (typeof views)[number];

const doneMessages: Record<string, string> = {
  approved: 'Approved and published.',
  rejected: 'Rejected.',
  reverified: 'Marked as still correct.',
  retired: 'Retired. Learners no longer see it.',
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ContentQueue({ searchParams }: PageProps<'/admin/content'>) {
  await requireReviewer();
  const params = await searchParams;
  const requested = single(params.view);
  const view: View = views.find((candidate) => candidate === requested) ?? 'questions';
  const country = single(params.country)?.toUpperCase() || undefined;
  const done = doneMessages[single(params.done) ?? ''];

  const db = getDb();
  const [counts, countries] = await Promise.all([
    getQueueCounts(db, country),
    listReviewCountries(db),
  ]);

  const tabs: { view: View; label: string; count: number }[] = [
    { view: 'questions', label: 'Questions', count: counts.questions },
    { view: 'translations', label: 'Translations', count: counts.translations },
    { view: 'source', label: 'Source changed', count: counts.sourceChanged },
  ];
  const href = (target: View) =>
    `/admin/content?view=${target}${country ? `&country=${country}` : ''}`;

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Review queue</h1>
      <p className="text-fg-muted mt-2 max-w-[70ch]">
        Nothing here is visible to learners until you approve it. Check each question against its
        source passage. {counts.published} published so far.
      </p>

      {done && (
        <div className="mt-6">
          <Notice tone="success" role="status">
            {done}
          </Notice>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <nav aria-label="Queues">
          <ul className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <li key={tab.view}>
                <Link
                  href={href(tab.view)}
                  aria-current={tab.view === view ? 'page' : undefined}
                  className={`${focusRing} block rounded-full border px-4 py-2 text-sm font-medium ${
                    tab.view === view
                      ? 'bg-primary text-on-primary border-primary'
                      : 'border-border-strong hover:bg-surface-sunken'
                  }`}
                >
                  {tab.label} ({tab.count})
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <form action="/admin/content" className="flex items-end gap-2">
          <input type="hidden" name="view" value={view} />
          <div>
            <label htmlFor="country" className="mb-1 block text-sm font-medium">
              Country
            </label>
            <select id="country" name="country" defaultValue={country ?? ''} className={fieldClass}>
              <option value="">All countries</option>
              {countries.map((entry) => (
                <option key={entry.isoCode} value={entry.isoCode}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonClass.secondary}>
            Show
          </button>
        </form>
      </div>

      <div className="mt-6">
        {view === 'translations' ? (
          <TranslationList country={country} />
        ) : (
          <QuestionList
            queue={view === 'source' ? 'source-changed' : 'pending'}
            country={country}
          />
        )}
      </div>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-border text-fg-muted rounded-lg border border-dashed px-6 py-10 text-center">
      {children}
    </p>
  );
}

async function QuestionList({
  queue,
  country,
}: {
  queue: 'pending' | 'source-changed';
  country?: string;
}) {
  const questions = await listQuestionQueue(getDb(), queue, country);
  if (questions.length === 0) {
    return (
      <Empty>
        {queue === 'pending'
          ? 'No questions are waiting for review. Draft more with “pnpm content draft”.'
          : 'No questions are flagged. The monthly source check adds them here when a cited passage changes.'}
      </Empty>
    );
  }
  return (
    <ul className="border-border bg-surface divide-border divide-y rounded-lg border">
      {questions.map((question) => (
        <li key={question.id}>
          <Link
            href={`/admin/content/questions/${question.id}`}
            className={`${focusRing} hover:bg-surface-sunken block px-4 py-3 sm:px-5`}
          >
            <span className="block font-medium">{question.text}</span>
            <span className="text-fg-muted mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>{question.countryCode}</span>
              <span>{question.topic}</span>
              <span>Difficulty {question.difficulty}</span>
              <StatusBadge status={question.status} />
              {question.isPossibleDuplicate && <Badge tone="warning">Possible duplicate</Badge>}
              {question.sourceChanged && <Badge tone="warning">Source changed</Badge>}
              {!question.hasSource && <Badge tone="warning">No stored passage</Badge>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function TranslationList({ country }: { country?: string }) {
  const translations = await listTranslationQueue(getDb(), country);
  if (translations.length === 0) {
    return (
      <Empty>
        No translations are waiting for review. Draft them with “pnpm content translate”.
      </Empty>
    );
  }
  return (
    <ul className="border-border bg-surface divide-border divide-y rounded-lg border">
      {translations.map((translation) => (
        <li key={`${translation.questionId}-${translation.locale}`}>
          <Link
            href={`/admin/content/translations/${translation.questionId}/${translation.locale}`}
            className={`${focusRing} hover:bg-surface-sunken block px-4 py-3 sm:px-5`}
          >
            <span className="block font-medium" lang={translation.locale}>
              {translation.text}
            </span>
            <span className="text-fg-muted mt-1 block text-sm" lang={translation.translatedFrom}>
              {translation.originalText}
            </span>
            <span className="text-fg-muted mt-1.5 flex flex-wrap items-center gap-x-3 text-sm">
              <span>{translation.countryCode}</span>
              <Badge>
                {translation.translatedFrom} to {translation.locale}
              </Badge>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
