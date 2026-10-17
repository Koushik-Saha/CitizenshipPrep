import { expect, test } from '@playwright/test';

import { sql } from '../database';
import { expectAccessible, newLearner, signIn, t } from './support';

// Questions answered in the learner's own words (free_response), like the
// US civics test's: their options are the accepted answers, every one right,
// so they must never be offered as a list to pick from. They get a country of
// their own, so the fixture's Testland sessions stay as they are.

const COUNTRY = 'ZO';
const learner = newLearner();

test.beforeAll(async () => {
  await cleanUp();
  await sql(
    `insert into public.countries (iso_code, name, has_exam, exam_languages, latitude, longitude)
     values ($1, 'Openland', true, '{en}', -40.0, -130.0)`,
    [COUNTRY],
  );
  const [topic] = await sql<{ id: string }>(
    `insert into public.topics (country_code, slug, name) values ($1, 'history', 'History')
     returning id`,
    [COUNTRY],
  );
  const questions = [
    { text: 'What war ended slavery in Openland?', answers: ['The Long War'] },
    {
      text: 'Name one reason settlers came to Openland.',
      answers: ['Freedom', 'Religious freedom', 'Economic opportunity'],
    },
  ];
  for (const question of questions) {
    const keys = question.answers.map((_, index) => String.fromCharCode(97 + index));
    const [row] = await sql<{ id: string }>(
      `insert into public.questions
         (country_code, topic_id, difficulty, type, correct_answer, source_url, status,
          verified_by, last_verified_at, origin)
       values ($1, $2, 1, 'free_response', $3, 'https://example.test/openland/guide',
               'published', 'test:reviewer', now(), 'official')
       returning id`,
      [COUNTRY, topic!.id, JSON.stringify({ keys })],
    );
    await sql(
      `insert into public.question_translations
         (question_id, locale, text, options, explanation, status, reviewed_by, reviewed_at)
       values ($1, 'en', $2, $3, 'The Openland guide says so. It is on page one.', 'approved',
               'test:reviewer', now())`,
      [
        row!.id,
        question.text,
        JSON.stringify(question.answers.map((text, index) => ({ key: keys[index], text }))),
      ],
    );
  }
  const user = `test:${learner}`;
  await sql('insert into public.profiles (id, display_name) values ($1, $2)', [user, 'Opal']);
  await sql(
    `insert into public.user_settings (user_id, daily_goal_minutes, onboarded_at)
     values ($1, 10, now())`,
    [user],
  );
  await sql(
    `insert into public.user_countries (user_id, country_code, exam_date, study_locale, is_primary)
     values ($1, $2, current_date + 30, 'en', true)`,
    [user, COUNTRY],
  );
});

test.afterAll(cleanUp);

async function cleanUp() {
  await sql('delete from public.profiles where id = $1', [`test:${learner}`]);
  await sql('delete from public.questions where country_code = $1', [COUNTRY]);
  await sql('delete from public.countries where iso_code = $1', [COUNTRY]);
}

test('an open question is answered aloud, then checked against the accepted answers', async ({
  page,
}) => {
  await signIn(page, learner);
  await page.getByRole('button', { name: t('dashboard.practise'), exact: true }).click();
  await expect(page).toHaveURL(/\/study\/session\/[0-9a-f-]{36}$/);

  for (let i = 0; i < 2; i += 1) {
    await expect(
      page.getByText(t('session.questionOf', { current: i + 1, total: 2 })),
    ).toBeVisible();
    // Nothing to pick from: picking would give the answer away, and every pick is right.
    await expect(page.getByText(t('session.sayAnswer'))).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.getByText('The Long War')).toBeHidden();
    if (i === 0) await expectAccessible(page, 'open question');

    await page.getByRole('button', { name: t('session.showAnswer'), exact: true }).click();
    const heading = await page.getByRole('heading', { level: 1 }).innerText();
    if (heading.startsWith('Name one reason')) {
      await expect(page.getByText(t('session.acceptedAnswers'))).toBeVisible();
      await expect(page.getByTestId('accepted-answers').getByRole('listitem')).toHaveText([
        'Freedom',
        'Religious freedom',
        'Economic opportunity',
      ]);
      await expectAccessible(page, 'open question, turned over');
      await page.getByRole('button', { name: new RegExp(t('session.didNotKnow')) }).click();
    } else {
      await expect(page.getByText('The Long War')).toBeVisible();
      await page.getByRole('button', { name: new RegExp(t('session.knewIt')) }).click();
    }
  }

  // One known, one missed: the learner's own marks are what count.
  await expect(page.getByRole('heading', { level: 1, name: t('results.complete') })).toBeVisible();
  // Saved in the background, so given a moment to arrive.
  await expect
    .poll(async () => {
      const [saved] = await sql<{ correct: number; total: number }>(
        `select count(*) filter (where e.correct)::int as correct, count(*)::int as total
           from public.answer_events e where e.user_id = $1`,
        [`test:${learner}`],
      );
      return saved;
    })
    .toEqual({ correct: 1, total: 2 });
});

test('a visitor sees an open question’s accepted answers only when they ask', async ({ page }) => {
  // The public samples: the accepted answers are the answer, so they are not listed first.
  await page.goto('/openland/citizenship-test');
  const sample = page
    .locator('section[aria-labelledby="samples"] ol > li')
    .filter({ hasText: 'Name one reason settlers came to Openland.' });
  await expect(sample.getByText('Religious freedom')).toBeHidden();
  await sample.getByText(t('countries.showAnswer')).click();
  await expect(sample.getByText(t('countries.acceptedAnswersLabel'))).toBeVisible();
  await expect(sample.getByText(/Religious freedom/)).toBeVisible();

  // The trial: said aloud, then marked.
  await page.goto('/openland/citizenship-test/try');
  await expect(page.getByText(t('session.sayAnswer'))).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  for (let i = 0; i < 2; i += 1) {
    await page.getByRole('button', { name: t('session.showAnswer'), exact: true }).click();
    await page.getByRole('button', { name: t('session.knewIt'), exact: true }).click();
  }
  await expect(page.getByTestId('trial-results').getByRole('heading')).toHaveText(
    t('trial.doneTitle', { correct: 2, total: 2 }),
  );
});
