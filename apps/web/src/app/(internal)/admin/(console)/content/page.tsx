import {
  getQueueCounts,
  listPendingTranslationLocales,
  pageQuestionQueue,
  pageTranslationQueue,
  PAGE_SIZES,
  queueLevels,
  queueOrigins,
  queueSorts,
  queueTypes,
  type QueueLevel,
  type QueueOrigin,
  type QueuePage,
  type QueueSort,
  type QueueType,
  listReviewCountries,
  listReviewTopics,
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
  'no-source': 'No source to check against',
  'has-source': 'Has a source to check against',
  freshness: 'Answer changes over time',
};

const originLabels: Record<QueueOrigin, string> = {
  official: 'Official questions',
  original: 'Written by Oathly',
  pipeline: 'Drafted from a guide',
};

const levelLabels: Record<QueueLevel, string> = {
  easy: 'Easy (1 to 2)',
  medium: 'Medium (3)',
  hard: 'Hard (4 to 5)',
};

const typeLabels: Record<QueueType, string> = {
  multiple_choice: 'Multiple choice',
  multi_select: 'Several answers',
  true_false: 'True or false',
  free_response: 'Spoken answer',
};

const sortLabels: Record<QueueSort, string> = {
  oldest: 'Oldest first',
  newest: 'Newest first',
  number: 'Official number',
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
  const origin = queueOrigins.find((candidate) => candidate === single(params.origin));
  const level = queueLevels.find((candidate) => candidate === single(params.level));
  const type = queueTypes.find((candidate) => candidate === single(params.type));
  const sort = queueSorts.find((candidate) => candidate === single(params.sort));
  const per = PAGE_SIZES.find((candidate) => String(candidate) === single(params.per));
  const pageNumber = Number(single(params.page) ?? 1);
  const paging = { page: Number.isInteger(pageNumber) ? pageNumber : 1, pageSize: per };
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
    origin: view === 'translations' ? undefined : origin,
    level: view === 'translations' ? undefined : level,
    type: view === 'translations' ? undefined : type,
    sort: view === 'translations' ? undefined : sort,
    locale: view === 'translations' ? locale : undefined,
    per: per ? String(per) : undefined,
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
    ...(filters.origin
      ? [{ label: originLabels[filters.origin], clear: href({ origin: undefined }) }]
      : []),
    ...(filters.level
      ? [{ label: levelLabels[filters.level], clear: href({ level: undefined }) }]
      : []),
    ...(filters.type
      ? [{ label: typeLabels[filters.type], clear: href({ type: undefined }) }]
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
            {view !== 'translations' && (
              <>
                <select
                  name="origin"
                  defaultValue={origin ?? ''}
                  aria-label="Where the wording comes from"
                  className={pill}
                >
                  <option value="">Any origin</option>
                  {queueOrigins.map((entry) => (
                    <option key={entry} value={entry}>
                      {originLabels[entry]}
                    </option>
                  ))}
                </select>
                <select
                  name="level"
                  defaultValue={level ?? ''}
                  aria-label="Difficulty"
                  className={pill}
                >
                  <option value="">Any difficulty</option>
                  {queueLevels.map((entry) => (
                    <option key={entry} value={entry}>
                      {levelLabels[entry]}
                    </option>
                  ))}
                </select>
                <select
                  name="type"
                  defaultValue={type ?? ''}
                  aria-label="Kind of question"
                  className={pill}
                >
                  <option value="">Any kind</option>
                  {queueTypes.map((entry) => (
                    <option key={entry} value={entry}>
                      {typeLabels[entry]}
                    </option>
                  ))}
                </select>
                <select name="sort" defaultValue={sort ?? ''} aria-label="Order" className={pill}>
                  {queueSorts.map((entry) => (
                    <option key={entry} value={entry === 'oldest' ? '' : entry}>
                      {sortLabels[entry]}
                    </option>
                  ))}
                </select>
              </>
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
            <select
              name="per"
              defaultValue={per ? String(per) : ''}
              aria-label="How many on a page"
              className={pill}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size === 50 ? '' : size}>
                  {size} a page
                </option>
              ))}
            </select>
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
            result={await pageTranslationQueue(
              db,
              { countryCode: country, search, locale },
              paging,
            )}
            back={back}
            pageHref={(page) => href({ page: page > 1 ? String(page) : undefined })}
            filtered={chips.length > 0}
          />
        ) : (
          <QuestionList
            queue={view === 'source' ? 'source-changed' : 'pending'}
            result={await pageQuestionQueue(
              db,
              view === 'source' ? 'source-changed' : 'pending',
              { countryCode: country, search, topic, flag, origin, level, type, sort },
              paging,
            )}
            back={back}
            pageHref={(page) => href({ page: page > 1 ? String(page) : undefined })}
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

/** "51 to 100 of 279", and the way to the other pages. Nothing when it all fits on one. */
function Pages({
  result,
  pageHref,
  noun,
}: {
  result: QueuePage<unknown>;
  pageHref: (page: number) => string;
  noun: string;
}) {
  const { page, pages, pageSize, total, items } = result;
  const first = (page - 1) * pageSize + 1;
  // The first and last page, the one shown and its neighbours; gaps are left as gaps.
  const shown = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((candidate) => candidate >= 1 && candidate <= pages)
    .sort((a, b) => a - b);
  const step = `${focusRing} border-border-strong hover:bg-surface-sunken inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-medium`;
  const off =
    'text-fg-subtle border-border inline-flex h-9 items-center rounded-md border px-3 text-sm';
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-fg-muted text-sm" data-testid="page-summary">
        {first} to {first + items.length - 1} of {total} {noun}
        {total === 1 ? '' : 's'}
      </p>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex flex-wrap items-center gap-1.5">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} rel="prev" className={step}>
              Previous
            </Link>
          ) : (
            <span className={off}>Previous</span>
          )}
          {shown.map((candidate, index) => (
            <span key={candidate} className="flex items-center gap-1.5">
              {index > 0 && candidate - shown[index - 1]! > 1 && (
                <span aria-hidden="true" className="text-fg-subtle px-1">
                  …
                </span>
              )}
              {candidate === page ? (
                <span
                  aria-current="page"
                  className="bg-primary text-on-primary inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-sm font-semibold"
                >
                  <span className="sr-only">Page </span>
                  {candidate}
                </span>
              ) : (
                <Link href={pageHref(candidate)} className={step}>
                  <span className="sr-only">Page </span>
                  {candidate}
                </Link>
              )}
            </span>
          ))}
          {page < pages ? (
            <Link href={pageHref(page + 1)} rel="next" className={step}>
              Next
            </Link>
          ) : (
            <span className={off}>Next</span>
          )}
        </nav>
      )}
    </div>
  );
}

function QuestionList({
  queue,
  result,
  back,
  pageHref,
  filtered,
}: {
  queue: 'pending' | 'source-changed';
  result: QueuePage<QueueQuestion>;
  back: string;
  pageHref: (page: number) => string;
  filtered: boolean;
}) {
  const questions = result.items;
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
                  <span>{typeLabels[question.type as QueueType] ?? question.type}</span>
                  <StatusBadge status={question.status} />
                  {question.origin === 'official' && (
                    <Badge tone="success">
                      Official{question.officialNumber ? ` no. ${question.officialNumber}` : ''}
                    </Badge>
                  )}
                  {question.origin === 'original' && <Badge>Written by Oathly</Badge>}
                  {question.sourceLocator && <span>{question.sourceLocator}</span>}
                  {question.needsFreshnessCheck && <Badge tone="warning">Answer changes</Badge>}
                  {question.isPossibleDuplicate && <Badge tone="warning">Possible duplicate</Badge>}
                  {question.sourceChanged && <Badge tone="warning">Source changed</Badge>}
                  {!question.hasSource && <Badge tone="warning">No source to check</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </BulkSelection>
      <Pages result={result} pageHref={pageHref} noun="question" />
    </form>
  );
}

function TranslationList({
  result,
  back,
  pageHref,
  filtered,
}: {
  result: QueuePage<QueueTranslation>;
  back: string;
  pageHref: (page: number) => string;
  filtered: boolean;
}) {
  const translations = result.items;
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
      <Pages result={result} pageHref={pageHref} noun="translation" />
    </form>
  );
}
