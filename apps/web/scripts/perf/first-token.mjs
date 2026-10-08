// Measures how long an AI explanation takes to start, against a running
// server with a real ANTHROPIC_API_KEY ("first token < 1 s" in the build
// checklist), and that asking again is answered from the cache.
//
//   BASE=http://localhost:3000 TEST_SIGN_IN_SECRET=... COUNTRY=AU \
//     QUESTIONS=<id>,<id>,... node scripts/perf/first-token.mjs
//
// QUESTIONS are ids of published questions that have a source passage and no
// stored explanation yet (each is explained once, then cached). The server
// must be one where the test sign-in works: a development server, never
// production. It costs a few cents of API use per run.
//
// FIRST_TOKEN_BUDGET_MS sets the pass mark (default 1000), on the median.

const base = process.env.BASE ?? 'http://localhost:3000';
const secret = process.env.TEST_SIGN_IN_SECRET;
const country = process.env.COUNTRY;
const questions = (process.env.QUESTIONS ?? '').split(',').filter(Boolean);
const budget = Number(process.env.FIRST_TOKEN_BUDGET_MS ?? 1000);
if (!secret || !country || questions.length === 0) {
  console.error('Set TEST_SIGN_IN_SECRET, COUNTRY and QUESTIONS. See the top of this file.');
  process.exit(2);
}

const user = `perf-${Math.random().toString(36).slice(2, 10)}`;
const signIn = await fetch(`${base}/api/test/sign-in?user=${user}&secret=${secret}&as=token`);
if (!signIn.ok) throw new Error(`Test sign-in failed: HTTP ${signIn.status}`);
const { token } = await signIn.json();
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

const onboarded = await fetch(`${base}/api/me/onboarding`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    countryCode: country,
    examDate: null,
    studyLocale: 'en',
    dailyGoalMinutes: 15,
  }),
});
if (!onboarded.ok)
  throw new Error(`Onboarding failed: HTTP ${onboarded.status} ${await onboarded.text()}`);

/** Asks for one explanation; times the first bytes of the answer and the whole of it. */
async function explain(questionId) {
  const started = performance.now();
  const response = await fetch(`${base}/api/explain`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ questionId }),
  });
  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const reader = response.body.getReader();
  let first = null;
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (first === null && value.length > 0) first = performance.now() - started;
    length += value.length;
  }
  return {
    source: response.headers.get('x-explanation-source'),
    first: Math.round(first ?? NaN),
    total: Math.round(performance.now() - started),
    length,
  };
}

// The first request also compiles the route on a development server: not a
// reader's wait, so it is made once and thrown away where there is a spare question.
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const generated = [];
const cached = [];
let failed = false;
console.log('question                               source     first   total  bytes');
for (const [index, id] of questions.entries()) {
  const fresh = await explain(id);
  const again = await explain(id);
  const warmUp = index === 0 && questions.length > 1;
  for (const [label, run] of [
    ['', fresh],
    [' (again)', again],
  ]) {
    console.log(
      `${id}  ${String(run.source).padEnd(9)} ${String(run.first).padStart(5)} ms ${String(run.total).padStart(5)} ms ${String(run.length).padStart(5)}${label}${warmUp && !label ? '  warm-up, not counted' : ''}`,
    );
  }
  if (fresh.source === 'generated' && !warmUp) generated.push(fresh.first);
  if (again.source !== 'cache') {
    console.error(`  ${id}: the second request was not answered from the cache.`);
    failed = true;
  } else {
    cached.push(again.first);
  }
}

if (generated.length === 0) {
  console.error(
    'No explanation was generated: every question already had one. Give fresh questions.',
  );
  process.exit(2);
}
console.log(
  `\nFirst token, generated: median ${median(generated)} ms, slowest ${Math.max(...generated)} ms over ${generated.length} (budget ${budget} ms).`,
);
console.log(`Repeat, from the cache: median ${median(cached)} ms over ${cached.length}.`);
if (median(generated) >= budget) {
  console.error('The first token took too long.');
  failed = true;
}
process.exit(failed ? 1 : 0);
