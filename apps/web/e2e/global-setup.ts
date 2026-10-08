import { request, type FullConfig } from '@playwright/test';

import { resetReviewQueue } from './database';

// The development server compiles a page the first time it is asked for,
// which on a busy machine takes longer than a test should wait. This asks for
// every page once, one at a time, before any test starts, so the tests
// measure the app and not the compiler.

const publicPages = [
  '/',
  '/countries',
  '/testland/citizenship-test',
  '/testland/citizenship-test/history',
  '/sign-in',
  '/privacy',
  '/terms',
  '/delete-account',
  '/account-deleted',
  '/join/not-a-real-invitation',
  '/this-page-does-not-exist',
  '/brand',
  '/admin/sign-in',
  '/sitemap.xml',
  '/api/public/countries',
];

// As a learner who has finished onboarding: the pages behind sign-in.
const learnerPages = [
  '/study',
  '/study/plans',
  '/study/account',
  '/study/tutor/zz',
  '/org',
  '/onboarding',
  '/api/study/dashboard',
  '/api/me',
];

export default async function globalSetup(config: FullConfig) {
  // Something for the reviewers' pages to review.
  await resetReviewQueue();

  const baseURL = config.projects[0]!.use.baseURL!;
  const api = await request.newContext({ baseURL, timeout: 180_000 });
  const visit = async (path: string) => {
    await api.get(path, { failOnStatusCode: false });
  };
  for (const path of publicPages) await visit(path);

  await visit(`/api/test/sign-in?user=e2e-warm-up&secret=${process.env.TEST_SIGN_IN_SECRET}`);
  await api.post('/api/me/onboarding', {
    data: { countryCode: 'ZZ', examDate: null, studyLocale: 'en', dailyGoalMinutes: 10 },
    failOnStatusCode: false,
  });
  for (const path of learnerPages) await visit(path);
  // A session and its API routes.
  const started = await api.post('/api/study/sessions', {
    data: { kind: 'practice', countryCode: 'ZZ', focus: 'random', size: 2 },
    failOnStatusCode: false,
  });
  if (started.ok()) {
    const { attemptId } = (await started.json()) as { attemptId: string };
    await visit(`/study/session/${attemptId}`);
    await api.post('/api/answers', { data: { answers: [] }, failOnStatusCode: false });
    await api.post(`/api/attempts/${attemptId}/complete`, {
      data: { correct: 0, total: 2, passed: null },
      failOnStatusCode: false,
    });
  }
  // The remaining API routes, each asked once so it is compiled.
  for (const path of [
    '/api/explain',
    '/api/tutor',
    '/api/me/time-zone',
    '/api/me/exam-result',
    '/api/study/sessions/offline',
    '/api/revalidate',
    '/api/billing/stripe/webhook',
    '/api/billing/revenuecat/webhook',
  ]) {
    await api.post(path, { data: {}, failOnStatusCode: false });
  }
  await visit('/api/countries');
  await visit('/api/packs/zz');
  await visit('/admin/content');
  await api.dispose();
}
