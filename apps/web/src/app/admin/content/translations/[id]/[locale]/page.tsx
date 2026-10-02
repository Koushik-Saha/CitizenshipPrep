import { getTranslationForReview } from '@oathly/content/review';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  buttonClass,
  fieldClass,
  focusRing,
  labelClass,
  Notice,
  StatusBadge,
} from '@/components/admin/ui';
import { getDb, requireReviewer } from '@/lib/admin';

import { approveTranslated, rejectTranslated } from '../../../actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ReviewTranslation({
  params,
  searchParams,
}: PageProps<'/admin/content/translations/[id]/[locale]'>) {
  await requireReviewer();
  const { id, locale: rawLocale } = await params;
  const locale = decodeURIComponent(rawLocale);
  const review = UUID.test(id) ? await getTranslationForReview(getDb(), id, locale) : null;
  if (!review) notFound();

  const problem = single((await searchParams).problem);
  const { original, translation } = review;

  return (
    <>
      <p className="text-sm">
        <Link
          href="/admin/content?view=translations"
          className={`${focusRing} text-primary-fg rounded-xs underline`}
        >
          Back to the queue
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold">Review translation</h1>
        <StatusBadge status={translation.status} />
      </div>
      <p className="text-fg-muted mt-1 text-sm">
        {review.countryName}, {original.locale} to {translation.locale}.{' '}
        <Link
          href={`/admin/content/questions/${review.questionId}`}
          className={`${focusRing} text-primary-fg rounded-xs underline`}
        >
          See the question and its source
        </Link>
      </p>

      {problem && (
        <div className="mt-6">
          <Notice tone="error" role="alert">
            {problem}
          </Notice>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="original-heading" lang={original.locale}>
          <h2 id="original-heading" lang="en" className="font-display text-xl font-medium">
            Original ({original.locale})
          </h2>
          <div className="bg-surface border-border mt-3 space-y-4 rounded-lg border p-5">
            <p className="font-medium">{original.text}</p>
            <ul className="space-y-1.5">
              {original.options.map((option) => {
                const correct = review.correctKeys.includes(option.key);
                return (
                  <li key={option.key} className="flex gap-3">
                    <span className="w-5 shrink-0 font-mono text-sm">{option.key}</span>
                    <span className={correct ? 'text-success-fg font-medium' : undefined}>
                      {option.text}
                      {correct && <span lang="en"> (correct)</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
            {original.explanation && (
              <p className="text-fg-muted text-sm">{original.explanation}</p>
            )}
          </div>
        </section>

        <section aria-labelledby="translation-heading">
          <h2 id="translation-heading" className="font-display text-xl font-medium">
            Translation ({translation.locale})
          </h2>
          <form
            action={approveTranslated.bind(null, review.questionId, translation.locale)}
            className="mt-3 space-y-5"
          >
            <div>
              <label htmlFor="text" className={labelClass}>
                Question
              </label>
              <textarea
                id="text"
                name="text"
                rows={3}
                required
                lang={translation.locale}
                defaultValue={translation.text}
                className={fieldClass}
              />
            </div>
            <fieldset>
              <legend className={labelClass}>Options, in the same order as the original</legend>
              <input
                type="hidden"
                name="option_keys"
                value={translation.options.map((option) => option.key).join(',')}
              />
              <ul className="space-y-2">
                {translation.options.map((option) => (
                  <li key={option.key} className="flex items-center gap-3">
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
                      lang={translation.locale}
                      defaultValue={option.text}
                      className={fieldClass}
                    />
                  </li>
                ))}
              </ul>
            </fieldset>
            <div>
              <label htmlFor="explanation" className={labelClass}>
                Explanation
              </label>
              <textarea
                id="explanation"
                name="explanation"
                rows={4}
                lang={translation.locale}
                defaultValue={translation.explanation ?? ''}
                className={fieldClass}
              />
            </div>
            <button type="submit" className={buttonClass.primary}>
              {translation.status === 'approved' ? 'Save changes' : 'Approve translation'}
            </button>
          </form>

          <form
            action={rejectTranslated.bind(null, review.questionId, translation.locale)}
            className="border-border mt-8 border-t pt-6"
          >
            <h3 className="font-medium">Reject</h3>
            <p className="text-fg-muted mt-1 text-sm">
              Removes this translation. The question can be translated into {translation.locale}{' '}
              again later.
            </p>
            <label htmlFor="note" className={`${labelClass} mt-3`}>
              Reason
            </label>
            <textarea id="note" name="note" rows={2} required className={fieldClass} />
            <button type="submit" className={`${buttonClass.danger} mt-3`}>
              Reject translation
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
