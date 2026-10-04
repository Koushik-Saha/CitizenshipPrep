// Checks the landing page's JavaScript budget against a running production
// server: the gzipped size of every script the HTML loads up front, which is
// "landing JS before 3D" in CLAUDE.md.
//
//   node scripts/perf/js-budget.mjs [base-url]
//
// It also fails if three.js is among those scripts: the 3D bundle must stay
// behind its dynamic import. Scripts marked nomodule (legacy polyfills that
// modern browsers never download) are not counted.

import { gzipSync } from 'node:zlib';

const base = process.argv[2] ?? 'http://localhost:3000';
const KIB = 1024;
/** The target in CLAUDE.md. Not met yet: Next 16 and React alone are about 128 KiB. */
const TARGET = 130 * KIB;
/** The ceiling CI enforces: today's size plus a little room. Lower it as the page gets lighter. */
const LIMIT = 140 * KIB;

const html = await (await fetch(`${base}/`)).text();
const tags = [...new Set(html.match(/<script[^>]*\ssrc="[^"]+\.js"[^>]*>/g) ?? [])];
let total = 0;
let has3d = false;
for (const tag of tags) {
  if (/\snomodule/i.test(tag)) continue;
  const src = /\ssrc="([^"]+)"/.exec(tag)[1];
  const body = Buffer.from(await (await fetch(new URL(src, base))).arrayBuffer());
  const size = gzipSync(body, { level: 9 }).length;
  total += size;
  const is3d = body.includes('WebGLRenderer');
  has3d ||= is3d;
  console.log(`${(size / KIB).toFixed(1).padStart(7)} KiB  ${src}${is3d ? '  <- three.js' : ''}`);
}
const kib = (bytes) => `${(bytes / KIB).toFixed(1)} KiB`;
console.log(
  `Landing JS before 3D: ${kib(total)} gzipped (target ${kib(TARGET)}, limit ${kib(LIMIT)})`,
);

if (tags.length === 0) {
  console.error('No scripts found: is the server running a production build?');
  process.exit(1);
}
if (has3d) {
  console.error('three.js is loaded up front. The 3D bundle must stay behind its dynamic import.');
  process.exit(1);
}
if (total > LIMIT) {
  console.error(`Over the limit by ${kib(total - LIMIT)}.`);
  process.exit(1);
}
if (total > TARGET) {
  // A GitHub Actions annotation; plain text elsewhere.
  console.log(
    `::warning title=Landing JS budget::${kib(total)} is over the ${kib(TARGET)} target in CLAUDE.md (within the ${kib(LIMIT)} limit).`,
  );
}
