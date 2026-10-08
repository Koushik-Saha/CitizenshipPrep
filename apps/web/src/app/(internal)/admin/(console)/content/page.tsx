import {
  BULK_LIMIT,
  getQueueCounts,
  listPendingTranslationLocales,
  listQuestionQueue,
  listReviewCountries,
  listReviewTopics,
  listTranslationQueue,
  queueFlags,
  type QueueFlag,
  type QueueQuestion,
  type QueueTranslation,
} from '@oathly/content/review';
import { languageName } from '@oathly/i18n';
import Link from 'next/link';

import { BulkSelection, FilterForm } from '@/components/admin/queue-controls';
import { Badge, buttonClass, focusRing, Notice, StatusBadge } from '@/components/ui';
import { getDb, requireReviewer } from '@/lib/admin';

import { decideQuestions, decideTranslations } from './actions';

const views = ['questions', 'translations', 'source'] as const;
type View = (typeof views)[number];

const flagLabels: Record<QueueFlag, string> = {
  duplicate: 'Possible duplicates',
  'no-source': 'No stored passage',
  'has-source': 'Has a stored passage',
};

/** What a decision came to, for the notice at the top: "approve" with a count is a bulk one. */
function doneMessage(done: string | undefined, count: number | null): string | null {
  const several = (one: string, many: string) =>
    count === null ? one : `${count} ${count === 1 ? one.toLowerCase() : many}`;
  switch (done) {
    case 'approved':
      return 'Approved and published.';
    case 'rejected':
      return 'Rejected.';
    case 'reverified':
      return 'Marked as still correct.';
    case 'retired':
      return 'Retired. Learners no longer see it.';
    case 'approve':
      return several('Approved and published.', 'approved and published.');
    case 'reject':
      return several('Rejected.', 'rejected.');
    case 'reverify':
      return several('Marked as still correct.', 'marked as still correct.');
    case 'retire':
      return several('Retired.', 'retired. Learners no longer see them.');
    default:
      return null;
  }
}

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** A menu that looks like a pill: its label inside it, the choice beside. */
const pill =
  'border-border-strong bg-surface text-fg hover:bg-surface-sunken h-10 rounded-full border ps-4 pe-9 text-sm font-medium ' +
  focusRing;

export default async function ContentQueue({ searchParams }: PageProps<'/admin/content'>) {
  await requireReviewer();
  const params = await searchParams;
  const requested = single(params.view);
  const view: View = views.find((candidate) => candidate === requested) ?? 'questions';
  const country = single(params.country)?.toUpperCase() || undefined;
  const search = single(params.q)?.trim().slice(0, 100) || undefined;
  const topic = single(params.topic) || undefined;
  const locale = single(params.locale) || undefined;
  const flag = queueFlags.find((candidate) => candidate === single(params.flag));
  const count = single(params.count);
  const done = doneMessage(single(params.done), count === undefined ? null : Number(count));
  const failed = Number(single(params.failed) ?? 0);
  const problem = single(params.problem);

  const db = getDb();
  const [counts, countries, topics, locales] = await Promise.all([
    getQueueCounts(db, country),
    listReviewCountries(db),
    country && view !== 'translations' ? listReviewTopics(db, country) : [],
    view === 'translations' ? listPendingTranslationLocales(db) : [],
  ]);

  // The filters in force, as the address carries them.
  const filters = {
    country,
    q: search,
    topic: view === 'translations' ? undefined : topic,
    flag: view === 'translations' ? undefined : flag,
    locale: view === 'translations' ? locale : undefined,
  };
  const href = (changes: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries({ view, ...filters, ...changes })) {
      if (value) query.set(name, value);
    }
    return `/admin/content?${query}`;
  };
  const back = href({}).split('?')[1] ?? '';

  const tabs: { view: View; label: string; count: number }[] = [
    { view: 'questions', label: 'Questions', count: counts.questions },
    { view: 'translations', label: 'Translations', count: counts.translations },
    { view: 'source', label: 'Source changed', count: counts.sourceChanged },
  ];

  const countryName = countries.find((entry) => entry.isoCode === country)?.name;
  const chips: { label: string; clear: string }[] = [
    ...(search ? [{ label: `“${search}”`, clear: href({ q: undefined }) }] : []),
    ...(country
      ? [{ label: countryName ?? country, clear: href({ country: undefined, topic: undefined }) }]
      : []),
    ...(filters.topic
      ? [
          {
            label: topics.find((entry) => entry.slug === filters.topic)?.name ?? filters.topic,
            clear: href({ topic: undefined }),
          },
        ]
      : []),
    ...(filters.flag
      ? [{ label: flagLabels[filters.flag], clear: href({ flag: undefined }) }]
      : []),
    ...(filters.locale
      ? [{ label: languageName(filters.locale, 'en'), clear: href({ locale: undefined }) }]
      : []),
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Review queue</h1>
          <p className="text-fg-muted mt-2 max-w-[70ch]">
            Nothing here is visible to learners until you approve it. Check each question against
            its source passage.
          </p>
        </div>
        <p className="bg-success-soft text-success-fg rounded-full px-4 py-1.5 text-sm font-medium">
          {counts.published} published{countryName ? ` for ${countryName}` : ''}
        </p>
      </div>

      {(done || problem) && (
        <div className="mt-6 space-y-3">
          {done && (
            <Notice tone="success" role="status">
              {done}
            </Notice>
          )}
          {failed > 0 && (
            <Notice tone="warning" role="status">
              {failed} could not be: {single(params.why)}
            </Notice>
          )}
          {problem && (
            <Notice tone="error" role="alert">
              {problem}
            </Notice>
          )}
        </div>
      )}

      {/* Which queue: a segmented control, each with what is waiting in it. */}
      <nav aria-label="Queues" className="mt-8">
        <ul className="bg-surface-sunken inline-flex flex-wrap gap-1 rounded-xl p-1">
          {tabs.map((tab) => {
            const current = tab.view === view;
            return (
              <li key={tab.view}>
                <Link
                  href={href({
                    view: tab.view,
                    topic: undefined,
                    flag: undefined,
                    locale: undefined,
                  })}
                  aria-current={current ? 'page' : undefined}
                  className={`${focusRing} flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                    current ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                      current ? 'bg-primary text-on-primary' : 'bg-surface text-fg-muted'
                    }`}
                  >
                    {tab.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Filters: search, then one menu each. They apply as they are changed. */}
      <div className="mt-4">
        <FilterForm>
          <input type="hidden" name="view" value={view} />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1 sm:max-w-sm">
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="text-fg-muted pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="9" cy="9" r="6" />
                <path d="m14 14 4 4" />
              </svg>
              <input
                type="search"
                name="q"
                defaultValue={search ?? ''}
                placeholder={view === 'translations' ? 'Search translations' : 'Search questions'}
                aria-label={view === 'translations' ? 'Search translations' : 'Search questions'}
                maxLength={100}
                className={`${focusRing} border-border-strong bg-surface placeholder:text-fg-subtle h-10 w-full rounded-full border ps-10 pe-4 text-sm`}
              />
            </div>
            <select
              name="country"
              defaultValue={country ?? ''}
              aria-label="Country"
              className={pill}
            >
              <option value="">All countries</option>
              {countries.map((entry) => (
                <option key={entry.isoCode} value={entry.isoCode}>
                  {entry.name}
                </option>
              ))}
            </select>
            {view !== 'translations' && topics.length > 0 && (
              <select name="topic" defaultValue={topic ?? ''} aria-label="Topic" className={pill}>
                <option value="">All topics</option>
                {topics.map((entry) => (
                  <option key={entry.slug} value={entry.slug}>
                    {entry.name}
                  </option>
                ))}
              </select>
            )}
            {view !== 'translations' && (
              <select name="flag" defaultValue={flag ?? ''} aria-label="Show" className={pill}>
                <option value="">Everything</option>
                {queueFlags.map((entry) => (
                  <option key={entry} value={entry}>
                    {flagLabels[entry]}
                  </option>
                ))}
              </select>
            )}
            {view === 'translations' && locales.length > 0 && (
              <select
                name="locale"
                defaultValue={locale ?? ''}
                aria-label="Language"
                className={pill}
              >
                <option value="">All languages</option>
                {locales.map((entry) => (
                  <option key={entry} value={entry}>
                    {languageName(entry, 'en')}
                  </option>
                ))}
              </select>
            )}
            {/* Without JavaScript the filters need a button; with it they apply themselves. */}
            <noscript>
              <button type="submit" className={buttonClass.secondary}>
                Apply
              </button>
            </noscript>
          </div>
        </FilterForm>

        {chips.length > 0 && (
          <ul aria-label="Filters in use" className="mt-3 flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <li key={chip.label}>
                <Link
                  href={chip.clear}
                  className={`${focusRing} bg-primary-soft text-primary-fg inline-flex items-center gap-1.5 rounded-full py-1 ps-3 pe-2 text-sm font-medium hover:opacity-80`}
                >
                  {chip.label}
                  <span aria-hidden="true" className="text-base leading-none">
                    ×
                  </span>
                  <span className="sr-only">: remove this filter</span>
                </Link>
              </li>
            ))}
            {chips.length > 1 && (
              <li>
                <Link
                  href={`/admin/content?view=${view}`}
                  className={`${focusRing} text-fg-muted hover:text-fg rounded-xs text-sm underline underline-offset-4`}
                >
                  Clear all
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="mt-6">
        {view === 'translations' ? (
          <TranslationList
            translations={await listTranslationQueue(db, {
              countryCode: country,
              search,
              locale,
            })}
            back={back}
            filtered={chips.length > 0}
          />
        ) : (
          <QuestionList
            queue={view === 'source' ? 'source-changed' : 'pending'}
            questions={await listQuestionQueue(
              db,
              view === 'source' ? 'source-changed' : 'pending',
              {
                countryCode: country,
                search,
                topic,
                flag,
              },
            )}
            back={back}
            filtered={chips.length > 0}
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

const reasonField = `${focusRing} border-border-strong bg-surface h-10 w-full rounded-md border px-3 text-sm`;

/**
 * What can be done with everything ticked. Approving asks the reviewer to say
 * they have checked each one; rejecting and retiring ask why.
 */
function BulkBar({
  approve,
  refuse,
}: {
  approve: { decision: string; label: string; confirm?: string };
  refuse: { decision: string; label: string; reason: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="space-y-2">
        {approve.confirm && (
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="checked" className="accent-primary mt-0.5 size-4" />
            <span>{approve.confirm}</span>
          </label>
        )}
        <button
          type="submit"
          name="decision"
          value={approve.decision}
          className={buttonClass.primary}
        >
          {approve.label}
        </button>
      </div>
      <div className="flex flex-1 flex-wrap items-end justify-end gap-2">
        <div className="min-w-48 flex-1 sm:max-w-xs">
          <label htmlFor="bulk-note" className="mb-1 block text-sm font-medium">
            {refuse.reason}
          </label>
          <input id="bulk-note" name="note" maxLength={500} className={reasonField} />
        </div>
        <button
          type="submit"
          name="decision"
          value={refuse.decision}
          className={buttonClass.danger}
        >
          {refuse.label}
        </button>
      </div>
    </div>
  );
}

const rowLink = `${focusRing} hover:bg-surface-sunken block flex-1 rounded-xs py-3 pe-4 sm:pe-5`;
const rowBox = 'flex items-start gap-3 ps-4 sm:ps-5';
const tick = 'accent-primary mt-4 size-4 shrink-0';

function QuestionList({
  queue,
  questions,
  back,
  filtered,
}: {
  queue: 'pending' | 'source-changed';
  questions: QueueQuestion[];
  back: string;
  filtered: boolean;
}) {
  if (questions.length === 0) {
    return (
      <Empty>
        {filtered
          ? 'Nothing matches these filters.'
          : queue === 'pending'
            ? 'No questions are waiting for review. Draft more with “pnpm content draft”.'
            : 'No questions are flagged. The monthly source check adds them here when a cited passage changes.'}
      </Empty>
    );
  }
  return (
    <form action={decideQuestions}>
      <input type="hidden" name="back" value={back} />
      <BulkSelection
        key={questions.map((question) => question.id).join()}
        total={questions.length}
        noun="question"
        bar={
          queue === 'pending' ? (
            <BulkBar
              approve={{
                decision: 'approve',
                label: 'Approve and publish',
                confirm: 'I have checked each selected question against its source.',
              }}
              refuse={{ decision: 'reject', label: 'Reject', reason: 'Reason, if rejecting' }}
            />
          ) : (
            <BulkBar
              approve={{ decision: 'reverify', label: 'Still correct' }}
              refuse={{ decision: 'retire', label: 'Retire', reason: 'Reason, if retiring' }}
            />
          )
        }
      >
        <ul className="border-border bg-surface divide-border divide-y rounded-b-lg border">
          {questions.map((question) => (
            <li key={question.id} className={rowBox}>
              <input
                type="checkbox"
                name="ids"
                value={question.id}
                aria-label={`Select: ${question.text}`}
                className={tick}
              />
              <Link href={`/admin/content/questions/${question.id}`} className={rowLink}>
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
      </BulkSelection>
      {questions.length >= 500 && <ListLimit />}
    </form>
  );
}

function TranslationList({
  translations,
  back,
  filtered,
}: {
  translations: QueueTranslation[];
  back: string;
  filtered: boolean;
}) {
  if (translations.length === 0) {
    return (
      <Empty>
        {filtered
          ? 'Nothing matches these filters.'
          : 'No translations are waiting for review. Draft them with “pnpm content translate”.'}
      </Empty>
    );
  }
  return (
    <form action={decideTranslations}>
      <input type="hidden" name="back" value={back} />
      <BulkSelection
        key={translations.map((entry) => `${entry.questionId}:${entry.locale}`).join()}
        total={translations.length}
        noun="translation"
        bar={
          <BulkBar
            approve={{
              decision: 'approve',
              label: 'Approve as drafted',
              confirm: 'I have read each selected translation against the original.',
            }}
            refuse={{ decision: 'reject', label: 'Reject', reason: 'Reason, if rejecting' }}
          />
        }
      >
        <ul className="border-border bg-surface divide-border divide-y rounded-b-lg border">
          {translations.map((translation) => (
            <li key={`${translation.questionId}-${translation.locale}`} className={rowBox}>
              <input
                type="checkbox"
                name="ids"
                value={`${translation.questionId}:${translation.locale}`}
                aria-label={`Select: ${translation.text}`}
                className={tick}
              />
              <Link
                href={`/admin/content/translations/${translation.questionId}/${translation.locale}`}
                className={rowLink}
              >
                <span className="block font-medium" lang={translation.locale}>
                  {translation.text}
                </span>
                <span
                  className="text-fg-muted mt-1 block text-sm"
                  lang={translation.translatedFrom}
                >
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
      </BulkSelection>
      {translations.length >= 500 && <ListLimit />}
    </form>
  );
}

function ListLimit() {
  return (
    <p className="text-fg-muted mt-3 text-sm">
      Showing the first 500. Narrow the list with the filters to see the rest. A bulk decision
      covers at most {BULK_LIMIT} at a time.
    </p>
  );
}
