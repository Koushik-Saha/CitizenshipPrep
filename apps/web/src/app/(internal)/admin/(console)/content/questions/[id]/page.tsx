import {
  getQuestionForReview,
  getQueueNeighbours,
  listApprovalTimes,
  type QuestionForReview,
} from '@oathly/content/review';
import { locateQuote } from '@oathly/content/text';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApprovedToday, ReviewKeys } from '@/components/admin/review-keys';
import {
  Badge,
  buttonClass,
  fieldClass,
  focusRing,
  formatDate,
  labelClass,
  Notice,
  StatusBadge,
} from '@/components/ui';
import { getDb, requireReviewer } from '@/lib/admin';
import { queueContext, queueHref, questionHref } from '@/lib/review-queue';

import { approve, reject, remove, retire, reverify, saveQuestion, unpublish } from '../../actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const historyLabels: Record<string, string> = {
  approved: 'Approved and published',
  edited: 'Edited',
  rejected: 'Rejected',
  reverified: 'Confirmed still correct',
  unpublished: 'Unpublished: back in the review queue',
  translation_approved: 'Translation approved',
  translation_rejected: 'Translation rejected',
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** What the last decision was, shown on the question it led to. */
const doneLabels: Record<string, string> = {
  approved: 'Approved and published.',
  rejected: 'Rejected.',
  reverified: 'Marked as still correct.',
  retired: 'Retired. Learners no longer see it.',
  unpublished: 'Unpublished. It is back in the review queue and learners no longer see it.',
  deleted: 'Deleted for good.',
};

const stepLink = buttonClass.secondary;

export default async function ReviewQuestion({
  params,
  searchParams,
}: PageProps<'/admin/content/questions/[id]'>) {
  const reviewer = await requireReviewer();
  const { id } = await params;
  const query = await searchParams;
  const db = getDb();
  const question = UUID.test(id) ? await getQuestionForReview(db, id) : null;
  if (!question) notFound();

  // The filter the reviewer came through, and this question's place in it.
  const from = queueContext(query);
  const [place, approvals] = await Promise.all([
    getQueueNeighbours(db, from.queue, from.filters, question.id),
    listApprovalTimes(db, reviewer.id),
  ]);
  const previous = place?.previous ? questionHref(place.previous, from.query) : null;
  const next = place?.next ? questionHref(place.next, from.query) : null;
  const done = doneLabels[single(query.done) ?? ''];

  const problem = single(query.problem);
  const saved = single(query.saved) === '1';
  const pending = question.status === 'draft' || question.status === 'in_review';
  const published = question.status === 'published';
  const editable = pending || published;
  const flagged = question.sourceChangedAt !== null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <Link
            href={queueHref(from.query)}
            className={`${focusRing} text-primary-fg rounded-xs underline`}
          >
            Back to the queue
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ApprovedToday times={approvals.map((time) => time.toISOString())} />
          <nav aria-label="Questions in this filter" className="flex items-center gap-2">
            {place && (
              <p className="text-fg-muted me-1 text-sm" data-testid="queue-place">
                {place.position} of {place.total}
              </p>
            )}
            <StepLink href={previous} shortcut="previous" keys="k">
              Previous
            </StepLink>
            <StepLink href={next} shortcut="next" keys="j">
              Next
            </StepLink>
          </nav>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold">Review question</h1>
        <StatusBadge status={question.status} />
        {flagged && <Badge tone="warning">Source changed</Badge>}
      </div>
      <p className="text-fg-muted mt-1 text-sm">
        {question.countryName}, version {question.version}
        {question.draftedByModel ? `, drafted by ${question.draftedByModel}` : ''}
        {question.lastVerifiedAt && question.verifiedBy
          ? `, verified by ${question.verifiedBy} on ${formatDate(question.lastVerifiedAt)}`
          : ''}
      </p>

      <div className="mt-4">
        <ReviewKeys key={question.id} canDecide={pending} />
      </div>

      <div className="mt-6 space-y-3">
        {done && (
          <Notice tone="success" role="status">
            {done} {place ? 'This is the next one.' : ''}
          </Notice>
        )}
        {problem && (
          <Notice tone="error" role="alert">
            {problem}
          </Notice>
        )}
        {saved && (
          <Notice tone="success" role="status">
            Changes saved.
          </Notice>
        )}
        {question.duplicateOf && (
          <Notice tone="warning">
            This looks like an existing question ({question.duplicateOf.status.replace('_', ' ')}
            ):{' '}
            <Link
              href={`/admin/content/questions/${question.duplicateOf.id}`}
              className={`${focusRing} rounded-xs font-medium underline`}
            >
              {question.duplicateOf.text}
            </Link>
          </Notice>
        )}
        {flagged && (
          <Notice tone="warning">
            The passage this question cites is no longer in the source, as of{' '}
            {formatDate(question.sourceChangedAt!)}. Open the source, then confirm the question is
            still correct, edit it, or retire it.
          </Notice>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SourcePanel question={question} />

        <section aria-labelledby="question-heading">
          <h2 id="question-heading" className="font-display text-xl font-medium">
            Question
          </h2>
          <form className="mt-3 space-y-5">
            <QueueFields query={from.query} next={place?.next ?? null} />
            <fieldset disabled={!editable} className="space-y-5">
              <div>
                <label htmlFor="text" className={labelClass}>
                  Question ({question.original.locale})
                </label>
                <textarea
                  id="text"
                  name="text"
                  rows={3}
                  required
                  lang={question.original.locale}
                  defaultValue={question.original.text}
                  className={fieldClass}
                />
              </div>

              <fieldset>
                <legend className={labelClass}>Options. Select the correct one.</legend>
                <input
                  type="hidden"
                  name="option_keys"
                  value={question.original.options.map((option) => option.key).join(',')}
                />
                <ul className="space-y-2">
                  {question.original.options.map((option) => (
                    <li key={option.key} className="flex items-center gap-3">
                      <input
                        type="radio"
                        id={`correct-${option.key}`}
                        name="correct"
                        value={option.key}
                        required
                        defaultChecked={question.correctKeys.includes(option.key)}
                        aria-label={`Option ${option.key} is correct`}
                        className={`${focusRing} accent-success size-5 shrink-0`}
                      />
                      <label
                        htmlFor={`option-${option.key}`}
                        className="w-5 shrink-0 font-mono text-sm"
                      >
                        {option.key}
                      </label>
                      <input
                        id={`option-${option.key}`}
                        name={`option_${option.key}`}
                        required
                        lang={question.original.locale}
                        defaultValue={option.text}
                        className={fieldClass}
                      />
                    </li>
                  ))}
                </ul>
              </fieldset>

              <div>
                <label htmlFor="explanation" className={labelClass}>
                  Explanation shown after answering
                </label>
                <textarea
                  id="explanation"
                  name="explanation"
                  rows={4}
                  lang={question.original.locale}
                  defaultValue={question.original.explanation ?? ''}
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="topic" className={labelClass}>
                    Topic
                  </label>
                  <select
                    id="topic"
                    name="topic"
                    defaultValue={question.topicId}
                    className={fieldClass}
                  >
                    {question.topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="difficulty" className={labelClass}>
                    Difficulty (1 easiest, 5 hardest)
                  </label>
                  <select
                    id="difficulty"
                    name="difficulty"
                    defaultValue={question.difficulty}
                    className={fieldClass}
                  >
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            {editable && (
              <div className="flex flex-wrap gap-3">
                {pending && (
                  <button
                    type="submit"
                    formAction={approve.bind(null, question.id)}
                    className={buttonClass.primary}
                    data-shortcut="approve"
                    aria-keyshortcuts="a"
                  >
                    Approve and publish
                  </button>
                )}
                <button
                  type="submit"
                  formAction={saveQuestion.bind(null, question.id)}
                  className={pending ? buttonClass.secondary : buttonClass.primary}
                  data-shortcut="save"
                  aria-keyshortcuts="s"
                >
                  Save changes
                </button>
              </div>
            )}
          </form>

          {flagged && (
            <DecisionForm
              title="Still correct?"
              decision="reverify"
              queue={{ query: from.query, next: place?.next ?? null }}
              hint="Confirms you checked the question against the current source. Renews the verification date."
              noteLabel="Note (optional)"
              action={reverify.bind(null, question.id)}
              button="Mark as still correct"
              tone="secondary"
            />
          )}
          {pending && (
            <DecisionForm
              title="Reject"
              decision="reject"
              queue={{ query: from.query, next: place?.next ?? null }}
              hint="The draft is kept, hidden, so the same question is recognised if it is drafted again."
              noteLabel="Reason"
              noteRequired
              action={reject.bind(null, question.id)}
              button="Reject draft"
              tone="danger"
            />
          )}
          {published && (
            <DecisionForm
              title="Unpublish"
              decision="unpublish"
              queue={{ query: from.query, next: place?.next ?? null }}
              hint="Sends the question back to the review queue. Learners stop seeing it at once, nothing is lost, and approving it publishes it again."
              noteLabel="Note (optional)"
              action={unpublish.bind(null, question.id)}
              button="Unpublish question"
              tone="secondary"
            />
          )}
          {published && (
            <DecisionForm
              title="Retire"
              decision="retire"
              queue={{ query: from.query, next: place?.next ?? null }}
              hint="Takes the question away from learners, for example when the law has changed."
              noteLabel="Reason"
              noteRequired
              action={retire.bind(null, question.id)}
              button="Retire question"
              tone="danger"
            />
          )}
          {reviewer.role === 'admin' && (
            <form
              action={remove.bind(null, question.id)}
              data-decision="delete"
              className="border-border mt-8 border-t pt-6"
            >
              <QueueFields query={from.query} next={place?.next ?? null} />
              <h3 className="font-medium">Delete</h3>
              <p className="text-fg-muted mt-1 text-sm">
                Removes the question for good, with its translations, reports and history. It cannot
                be undone{published ? '; to take it down and keep it, unpublish it' : ''}. A
                question a learner has already answered cannot be deleted.
              </p>
              <label className="mt-3 flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="sure"
                  required
                  className="accent-primary mt-0.5 size-4"
                />
                <span>I understand it cannot be brought back.</span>
              </label>
              <button type="submit" className={`${buttonClass.danger} mt-3`}>
                Delete question
              </button>
            </form>
          )}
        </section>
      </div>

      {question.translations.length > 0 && (
        <section aria-labelledby="translations-heading" className="mt-10">
          <h2 id="translations-heading" className="font-display text-xl font-medium">
            Translations
          </h2>
          <ul className="mt-3 flex flex-wrap gap-3">
            {question.translations.map((translation) => (
              <li key={translation.locale}>
                <Link
                  href={`/admin/content/translations/${question.id}/${translation.locale}`}
                  className={`${focusRing} border-border-strong hover:bg-surface-sunken flex items-center gap-2 rounded-md border px-3 py-2`}
                >
                  <span className="font-mono text-sm">{translation.locale}</span>
                  <StatusBadge status={translation.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {question.history.length > 0 && (
        <section aria-labelledby="history-heading" className="mt-10">
          <h2 id="history-heading" className="font-display text-xl font-medium">
            History
          </h2>
          <ul className="text-fg-muted mt-3 space-y-1.5 text-sm">
            {question.history.map((entry, index) => (
              <li key={index}>
                {formatDate(entry.createdAt)}: {historyLabels[entry.action] ?? entry.action}
                {entry.locale ? ` (${entry.locale})` : ''} by{' '}
                {entry.reviewer ?? 'a removed account'}
                {entry.note ? `. “${entry.note}”` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function SourcePanel({ question }: { question: QuestionForReview }) {
  const { passage, sourceQuote } = question;
  const found = passage && sourceQuote ? locateQuote(passage.text, sourceQuote) : null;
  // A question loaded from a file says where its answer is, in words.
  const cited = question.origin || question.sourceLocator || question.needsFreshnessCheck;

  return (
    <section aria-labelledby="source-heading">
      <h2 id="source-heading" className="font-display text-xl font-medium">
        Source
      </h2>
      <div className="bg-surface border-border mt-3 rounded-lg border p-5">
        {cited && (
          <dl className="mb-4 space-y-3 text-sm">
            {question.origin && (
              <div>
                <dt className="text-fg-muted">Wording</dt>
                <dd className="font-medium">
                  {question.origin === 'official'
                    ? `The official question${question.officialNumber ? `, no. ${question.officialNumber}` : ''}, copied word for word`
                    : 'Written by Swornly from the official material'}
                </dd>
              </div>
            )}
            {question.sourceLocator && (
              <div>
                <dt className="text-fg-muted">Where to look</dt>
                <dd className="font-medium">{question.sourceLocator}</dd>
              </div>
            )}
            {question.needsFreshnessCheck && (
              <div>
                <dt className="text-fg-muted">Before approving</dt>
                <dd className="font-medium">
                  The answer changes over time (an officeholder or a figure). Check it is current.
                </dd>
              </div>
            )}
          </dl>
        )}
        {passage ? (
          <>
            <p className="font-medium">{passage.documentTitle}</p>
            <p className="text-fg-muted text-sm">
              {[passage.publisher, passage.heading].filter(Boolean).join(', ')}
            </p>
            {passage.matchedByQuote && (
              <p className="text-fg-muted mt-2 text-sm">
                The question names no passage. This one was found by its quoted words.
              </p>
            )}
            {!passage.isCurrent && (
              <p className="text-accent-fg mt-2 text-sm font-medium">
                This is the passage as it was when the question was written. It is no longer in the
                source.
              </p>
            )}
            {sourceQuote && found && (
              <p className="border-accent mt-4 border-l-4 pl-3 text-sm">
                <span className="text-fg-muted block">Cited as the basis for the answer:</span>
                <span className="font-medium">“{sourceQuote}”</span>{' '}
                <a href="#cited" className={`${focusRing} text-primary-fg rounded-xs underline`}>
                  Show it in the passage
                </a>
              </p>
            )}
            <p
              className="border-border relative mt-4 max-h-[28rem] overflow-y-auto rounded-sm border p-3 text-sm leading-relaxed whitespace-pre-wrap"
              tabIndex={0}
              role="region"
              aria-label="Source passage"
              data-passage
            >
              {found ? (
                <>
                  {passage.text.slice(0, found.start)}
                  <mark
                    id="cited"
                    className="bg-accent-soft text-fg scroll-mt-20 rounded-xs px-0.5 font-medium"
                  >
                    {passage.text.slice(found.start, found.end)}
                  </mark>
                  {passage.text.slice(found.end)}
                </>
              ) : (
                passage.text
              )}
            </p>
            {sourceQuote && !found && (
              <p className="text-error-fg mt-3 text-sm">
                The cited words were not found in this passage: “{sourceQuote}”
              </p>
            )}
          </>
        ) : sourceQuote ? (
          <div className="text-sm">
            <p className="text-fg-muted">The words it rests on</p>
            <p className="border-accent mt-1 border-l-4 pl-3 font-medium">“{sourceQuote}”</p>
            <p className="text-fg-muted mt-3" data-testid="no-passage">
              The passage around these words is not shown: the source document has not been loaded
              into Swornly, or the words are not in it as quoted. Open the source to read them in
              place.
            </p>
          </div>
        ) : (
          <p className="text-fg-muted text-sm">
            No passage is stored for this question. Check it against the source document itself.
          </p>
        )}
        <p className="mt-4 text-sm">
          <a
            href={question.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${focusRing} text-primary-fg rounded-xs font-medium break-all underline`}
          >
            Open the source (new tab)
          </a>
        </p>
      </div>
    </section>
  );
}

/** The filter being worked through and what comes next in it, sent with every decision. */
function QueueFields({ query, next }: { query: string; next: string | null }) {
  return (
    <>
      <input type="hidden" name="queue" value={query} />
      <input type="hidden" name="next" value={next ?? ''} />
    </>
  );
}

/** "Previous" or "Next", when there is one: at either end of the filter there is nothing to show. */
function StepLink({
  href,
  shortcut,
  keys,
  children,
}: {
  href: string | null;
  shortcut: string;
  keys: string;
  children: React.ReactNode;
}) {
  if (!href) return null;
  return (
    <Link href={href} className={stepLink} data-shortcut={shortcut} aria-keyshortcuts={keys}>
      {children}
    </Link>
  );
}

function DecisionForm({
  title,
  decision,
  queue,
  hint,
  noteLabel,
  noteRequired = false,
  action,
  button,
  tone,
}: {
  title: string;
  /** Which decision this is, for the keys that reach it. */
  decision: string;
  queue: { query: string; next: string | null };
  hint: string;
  noteLabel: string;
  noteRequired?: boolean;
  action: (form: FormData) => Promise<void>;
  button: string;
  tone: 'secondary' | 'danger';
}) {
  const id = `note-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <form action={action} data-decision={decision} className="border-border mt-8 border-t pt-6">
      <QueueFields {...queue} />
      <h3 className="font-medium">{title}</h3>
      <p className="text-fg-muted mt-1 text-sm">{hint}</p>
      <label htmlFor={id} className={`${labelClass} mt-3`}>
        {noteLabel}
      </label>
      <textarea id={id} name="note" rows={2} required={noteRequired} className={fieldClass} />
      <button type="submit" className={`${buttonClass[tone]} mt-3`}>
        {button}
      </button>
    </form>
  );
}
