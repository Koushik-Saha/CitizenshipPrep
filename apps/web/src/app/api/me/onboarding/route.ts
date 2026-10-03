import { getMe, OnboardingError, saveOnboarding } from '@oathly/api/server';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return jsonError('Send the answers as JSON.', 400);
  try {
    await saveOnboarding(getDb(), userId, body as Parameters<typeof saveOnboarding>[2]);
  } catch (error) {
    if (error instanceof OnboardingError) return jsonError(error.message, 400);
    throw error;
  }
  return Response.json(await getMe(getDb(), userId));
}
