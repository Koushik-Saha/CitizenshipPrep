import { jsonError } from './api-auth';

/** A zod schema, as much of one as is used here. */
interface Schema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

/**
 * A request's JSON body, checked against a schema: the data, or the 400 to
 * answer with. Nothing a client sends is used before it has been through here.
 */
export async function readJson<T>(
  request: Request,
  schema: Schema<T>,
  hint: string,
): Promise<{ data: T; problem?: undefined } | { data?: undefined; problem: Response }> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  return parsed.success ? { data: parsed.data } : { problem: jsonError(hint, 400) };
}
