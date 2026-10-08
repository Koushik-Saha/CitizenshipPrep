// Checks that nothing secret is in what browsers and phones download.
//
//   node scripts/security/client-bundles.mjs [directory ...]
//
// With no directories it looks at the web app's client files
// (apps/web/.next/static) and the phone app's bundles (apps/mobile/dist),
// whichever exist: build first. It fails on any of:
//
//   1. the value of a server-only environment variable (read from the
//      environment and, on a laptop, from .env.local);
//   2. something shaped like a credential, whoever's it is;
//   3. the name of a server-only variable, which only gets into a client file
//      when server code has been bundled into it.
//
// CI builds with marker values for the secrets that do not reach out to a
// service, so check 1 is a real test there and not an empty one.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Variables only the server may read. Anything public is prefixed NEXT_PUBLIC_ or EXPO_PUBLIC_. */
const serverOnly = [
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'ANTHROPIC_API_KEY',
  'GOOGLE_TTS_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'REVENUECAT_WEBHOOK_SECRET',
  'MAILTRAP_TOKEN',
  'ADMIN_PASSWORD',
  'NEON_AUTH_COOKIE_SECRET',
  'REVALIDATE_SECRET',
  'TEST_SIGN_IN_SECRET',
  'RATE_LIMIT_SECRET',
  'SENTRY_AUTH_TOKEN',
];

/** What credentials look like, for the ones with a recognisable shape. */
const shapes = [
  ['a Stripe secret key', /\b[sr]k_(live|test)_[0-9A-Za-z]{16,}/],
  ['a Stripe webhook secret', /\bwhsec_[0-9A-Za-z]{16,}/],
  ['an Anthropic API key', /\bsk-ant-[0-9A-Za-z_-]{16,}/],
  ['a database address with a password', /\bpostgres(?:ql)?:\/\/[^\s:"'`/]+:[^\s@"'`]+@[^\s"'`]+/],
  ['a Neon API key', /\bnapi_[0-9a-z]{32,}/],
  ['a Sentry auth token', /\bsntry[su]_[0-9A-Za-z_=-]{32,}/],
  ['a PostHog personal API key', /\bphx_[0-9A-Za-z]{32,}/],
  ['a Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  // The marker followed by key material. The marker alone is in any library
  // that can read keys (the sign-in client's JWT code has it), and is no key.
  [
    'a private key',
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----(?:\\r|\\n|\s)*[A-Za-z0-9+/]{64}/,
  ],
];

/** Values from the environment, and from .env.local where there is one. Never printed. */
function secretValues() {
  const values = new Map();
  const note = (name, value) => {
    const trimmed = value?.trim().replace(/^["']|["']$/g, '');
    // Short values are not secrets, and would match by accident.
    if (trimmed && trimmed.length >= 12) values.set(trimmed, name);
  };
  for (const name of serverOnly) note(name, process.env[name]);
  const envFile = path.join(root, '.env.local');
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (match && serverOnly.includes(match[1])) note(match[1], match[2]);
    }
  }
  return values;
}

function* files(directory) {
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) yield* files(full);
    else if (/\.(js|mjs|cjs|css|html|json|map|hbc|txt)$/.test(entry)) yield full;
  }
}

const asked = process.argv.slice(2).map((directory) => path.resolve(directory));
const targets = (
  asked.length > 0
    ? asked
    : [path.join(root, 'apps/web/.next/static'), path.join(root, 'apps/mobile/dist')]
).filter((directory) => {
  if (existsSync(directory)) return true;
  if (asked.length > 0) {
    console.error(`No such directory: ${directory}`);
    process.exit(1);
  }
  return false;
});
if (targets.length === 0) {
  console.error('Nothing to check: build the web app or bundle the phone app first.');
  process.exit(1);
}

const values = secretValues();
const findings = [];
let checked = 0;
for (const target of targets) {
  for (const file of files(target)) {
    // Bundles are read as text: a compiled phone bundle still holds its strings.
    const text = readFileSync(file, 'latin1');
    const where = path.relative(root, file);
    checked += 1;
    for (const [value, name] of values) {
      if (text.includes(value)) findings.push(`${where}: contains the value of ${name}`);
    }
    for (const [what, shape] of shapes) {
      if (shape.test(text)) findings.push(`${where}: contains ${what}`);
    }
    for (const name of serverOnly) {
      if (new RegExp(`\\b${name}\\b`).test(text)) {
        findings.push(`${where}: names ${name}, so server code has been bundled for the client`);
      }
    }
  }
}

const places = targets.map((target) => path.relative(root, target)).join(', ');
if (findings.length > 0) {
  console.error(`Secrets in client files (${places}):\n  ${[...new Set(findings)].join('\n  ')}`);
  process.exit(1);
}
console.log(
  `No secrets in ${checked} client files (${places}): checked ${values.size} secret values, ` +
    `${shapes.length} credential shapes and ${serverOnly.length} server-only names.`,
);
