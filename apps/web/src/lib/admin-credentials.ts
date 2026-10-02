import { createHash, timingSafeEqual } from 'node:crypto';

// Interim sign-in for the admin area, until an auth provider is wired in:
// one account, defined by ADMIN_USERNAME and ADMIN_PASSWORD, checked with HTTP
// Basic auth. With either variable unset the admin area does not exist.

const MIN_PASSWORD_LENGTH = 12;

interface AdminAccount {
  username: string;
  password: string;
}

function configuredAccount(): AdminAccount | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password || password.length < MIN_PASSWORD_LENGTH) return null;
  return { username, password };
}

export function isAdminConfigured(): boolean {
  return configuredAccount() !== null;
}

// Comparing hashes keeps the comparison constant-time whatever the lengths.
function sameSecret(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** The signed-in admin's username, or null if the header does not match the account. */
export function verifyBasicAuth(header: string | null): string | null {
  const account = configuredAccount();
  if (!account || !header?.startsWith('Basic ')) return null;
  const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator < 0) return null;
  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  const matches = sameSecret(username, account.username) && sameSecret(password, account.password);
  return matches ? account.username : null;
}
