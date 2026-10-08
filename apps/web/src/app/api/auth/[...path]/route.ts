import { getAuth } from '@/lib/auth/server';
import { addressOf, emailKey, rateLimited } from '@/lib/rate-limit';

// Proxies sign-in requests to Neon Auth and sets this site's session cookies.
//
// Requests that do something (POST) are rate limited before they are passed
// on: per network address, and, for the ones that send an email, per
// recipient, so this site cannot be used to fill someone's inbox. Neon Auth
// keeps its own limits behind this; these are the ones we control.
type Context = { params: Promise<{ path: string[] }> };

export function GET(request: Request, context: Context) {
  return getAuth().handler().GET(request, context);
}

/**
 * The address a sign-in email would go to, if this request sends one: asking
 * for a code, a link or a password reset. Typing a code in is not one, though
 * it names the address too.
 */
async function recipientOf(request: Request, path: string[]): Promise<string | null> {
  const last = path.at(-1) ?? '';
  if (!/^send-|magic-link|forget-password|request-password-reset/.test(last)) return null;
  const body: unknown = await request
    .clone()
    .json()
    .catch(() => null);
  const email = (body as { email?: unknown } | null)?.email;
  return typeof email === 'string' && email.length <= 254 ? email : null;
}

export async function POST(request: Request, context: Context) {
  const limited = await rateLimited('authByAddress', 'address', addressOf(request));
  if (limited) return limited;
  const recipient = await recipientOf(request, (await context.params).path);
  if (recipient) {
    const mailed = await rateLimited('authByEmail', 'email', emailKey(recipient));
    if (mailed) return mailed;
  }
  return getAuth().handler().POST(request, context);
}
