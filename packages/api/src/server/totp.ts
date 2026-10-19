import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

// The second factor staff sign in to the reviewers' area with: time-based
// one-time codes (RFC 6238) from an authenticator app, as every such app
// makes them: SHA-1, six digits, a new code every thirty seconds.
//
// Pure functions: the web app keeps the secret (sealed) in the database and
// hands it in with the time.

/** How long one code lasts. */
export const TOTP_STEP_SECONDS = 30;
const DIGITS = 6;
/** Codes from one step either side are accepted, for clocks that disagree a little. */
const DRIFT_STEPS = 1;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Bytes as base32 (RFC 4648, no padding): how authenticator apps take a secret. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let text = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      text += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) text += ALPHABET[(value << (5 - bits)) & 31];
  return text;
}

/** Base32 back to bytes. Spaces, dashes, padding and case are ignored; null if anything else is in it. */
export function base32Decode(text: string): Buffer | null {
  const clean = text.replace(/[\s=-]/g, '').toUpperCase();
  if (!clean) return null;
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const letter of clean) {
    const index = ALPHABET.indexOf(letter);
    if (index < 0) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A new secret for an authenticator: 160 random bits, as base32. */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The secret in groups of four, which is easier to type into a phone. */
export function spellSecret(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, '$1 ');
}

/** The time step a moment falls in. */
export function totpStep(now: Date): number {
  return Math.floor(now.getTime() / 1000 / TOTP_STEP_SECONDS);
}

/** The code an authenticator shows for a secret during one time step. */
export function totpCode(secret: string, step: number): string {
  const key = base32Decode(secret);
  if (!key) throw new Error('The secret is not base32.');
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', key).update(counter).digest();
  // "Dynamic truncation": the last nibble says where to read four bytes.
  const offset = digest[digest.length - 1]! & 15;
  const number = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(number % 10 ** DIGITS).padStart(DIGITS, '0');
}

/**
 * The time step a typed code is good for, or null. A code from the step
 * before or after now is accepted. A step at or before `lastStep` is not: a
 * code works once, so one read over a shoulder is useless a moment later.
 */
export function matchTotp(
  secret: string,
  typed: string,
  now: Date,
  lastStep: number | null = null,
): number | null {
  const code = typed.replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return null;
  const current = totpStep(now);
  let matched: number | null = null;
  // Every candidate is compared, so the time taken says nothing about which matched.
  for (let step = current - DRIFT_STEPS; step <= current + DRIFT_STEPS; step += 1) {
    const same = timingSafeEqual(Buffer.from(totpCode(secret, step)), Buffer.from(code));
    if (same && (lastStep === null || step > lastStep) && matched === null) matched = step;
  }
  return matched;
}

/** The address an authenticator app opens (or reads from a QR code) to add the account. */
export function otpauthUri(secret: string, account: string, issuer = 'Swornly'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query}`;
}

// --- Keeping the secret --------------------------------------------------------

/**
 * A 256-bit key for one purpose, made from a secret the server holds. Each
 * purpose gets its own key, so the one that signs sessions cannot open
 * authenticator secrets.
 */
export function deriveKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'oathly-admin', purpose, 32));
}

/** Seals text with AES-256-GCM, for keeping in the database. */
export function sealSecret(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const sealed = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), sealed]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

/** Opens what sealSecret made. Null if it was sealed with another key or has been altered. */
export function openSecret(key: Buffer, sealed: string): string | null {
  const [version, iv, tag, body] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !body) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(body, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
