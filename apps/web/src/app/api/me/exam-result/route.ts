import { examResultRequestSchema } from '@oathly/api/schemas';
import { getDashboard, reportExamResult } from '@oathly/api/server';
import { examResultEvent, platformOf } from '@oathly/core';

import { track } from '@/lib/analytics';
import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';
import { readJson } from '@/lib/http';
import { rateLimited } from '@/lib/rate-limit';

// POST /api/me/exam-result { countryCode, result }: how the learner's real
// exam went, as they report it. Answers with the dashboard as it now is.
export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const limited = await rateLimited('examResult', 'user', userId);
  if (limited) return limited;
  const { data, problem } = await readJson(
    request,
    examResultRequestSchema,
    'Send { "countryCode", "result": "passed" | "failed" }.',
  );
  if (problem) return problem;
  const country = data.countryCode.toUpperCase();
  if (!(await reportExamResult(getDb(), userId, country, data.result))) {
    return jsonError('You are not studying for that exam.', 404);
  }
  track(userId, examResultEvent(data.result), {
    country,
    platform: platformOf(request.headers.get('authorization')),
  });
  return Response.json(await getDashboard(getDb(), userId), {
    headers: { 'cache-control': 'private, no-store' },
  });
}
