import { createPool } from '@oathly/content/db';
import { betterAuth } from 'better-auth';
import { toNextJsHandler } from 'better-auth/next-js';
import { emailOTP, jwt } from 'better-auth/plugins';

import { isMailConfigured, sendMails } from '../mailer';

// Self-hosted Better Auth: the same library Neon Auth manages for us, run by
// this app against this app's own database. It reads the very tables Neon
// Auth created (the neon_auth schema — the connection's search_path puts it
// first), so accounts, passwords and codes carry over untouched: nobody has
// to sign up again, and profiles keep pointing at the same user ids.
//
// Loaded lazily (see lib/auth/server.ts): it pulls in the database driver,
// which the proxy's runtime cannot carry.

type SelfHostedAuth = ReturnType<typeof createSelfHostedAuth>;

const globalForSelfHosted = globalThis as typeof globalThis & {
  oathlySelfHostedAuth?: SelfHostedAuth;
  oathlySelfHostedHandlers?: ReturnType<typeof toNextJsHandler>;
};

/** The auth tables live in the neon_auth schema; everything else is public. */
function authDatabaseUrl(): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('options', '-c search_path=neon_auth,public');
  return url.toString();
}

/**
 * Sends one sign-in email through the app's own mailer, and fails loudly when
 * it cannot: a code that never arrives must not look like one that did.
 * (Neon Auth sent these itself, from its own mail server; self-hosted, they
 * go through Mailtrap like the organization invitations, so EMAIL_FROM must
 * be a sender Mailtrap has verified.)
 */
async function sendAuthMail(to: string, subject: string, text: string): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error('Sign-in email is not configured. Set MAILTRAP_TOKEN and EMAIL_FROM.');
  }
  const [sent] = await sendMails([
    { to, subject, text, html: `<p>${text}</p>`, category: 'auth' },
  ]);
  if (!sent) throw new Error(`Could not send a sign-in email to ${to}.`);
}

function createSelfHostedAuth(secret: string) {
  const googleId = process.env.GOOGLE_CLIENT_ID;
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
  return betterAuth({
    appName: 'Swornly',
    baseURL: process.env.SITE_URL,
    secret,
    database: createPool(authDatabaseUrl()),
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthMail(
          user.email,
          'Reset your Swornly password',
          `Use this link to reset your Swornly password: ${url}`,
        );
      },
    },
    // Neon Auth signed people in with Google's shared keys, which cannot be
    // reused. Until our own Google OAuth app exists (GOOGLE_CLIENT_ID and
    // GOOGLE_CLIENT_SECRET), the Google button has nothing to talk to and
    // the sign-in form shows its error; email codes and passwords work.
    socialProviders:
      googleId && googleSecret
        ? { google: { clientId: googleId, clientSecret: googleSecret } }
        : {},
    plugins: [
      emailOTP({
        // Neon Auth's codes lived five minutes; keep the same promise.
        expiresIn: 300,
        async sendVerificationOTP({ email, otp, type }) {
          const subject =
            type === 'forget-password'
              ? 'Your Swornly password reset code'
              : 'Your Swornly sign-in code';
          await sendAuthMail(
            email,
            subject,
            `Your Swornly code is ${otp}. It expires in 5 minutes. If you did not ask for it, you can ignore this email.`,
          );
        },
      }),
      // Access tokens for the mobile app, with the keys published at
      // /api/auth/jwks — the self-hosted counterpart of Neon Auth's JWKS.
      jwt(),
    ],
  });
}

export function getSelfHostedAuth(secret: string): SelfHostedAuth {
  globalForSelfHosted.oathlySelfHostedAuth ??= createSelfHostedAuth(secret);
  return globalForSelfHosted.oathlySelfHostedAuth;
}

/** The /api/auth route handlers, in Next's shape. */
export function getSelfHostedHandlers(secret: string) {
  globalForSelfHosted.oathlySelfHostedHandlers ??= toNextJsHandler(
    getSelfHostedAuth(secret).handler,
  );
  return globalForSelfHosted.oathlySelfHostedHandlers;
}

/** The signed-in user for a request's headers, or null. */
export async function getSelfHostedSession(secret: string, headers: Headers) {
  const session = await getSelfHostedAuth(secret).api.getSession({ headers });
  return session?.user ?? null;
}
