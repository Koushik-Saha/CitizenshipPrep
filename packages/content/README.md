# @oathly/content

The content pipeline: official study guides in, reviewed questions out. A CLI drives it and the
admin UI at `/admin/content` is where people review what it produces.

Nothing the pipeline writes is visible to learners. A question is published only when a reviewer
approves it, which records who verified it and when.

## The pipeline

| Step | Command                      | What happens                                                                                                                  |
| ---- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 0    | `pnpm content topic`         | Enters the guide's own topics first, so drafts are filed under them and an exam's sections can name them                      |
| 1    | `pnpm content ingest`        | Fetches a guide (PDF, web page or file), stores it as hashed passages                                                         |
| 2, 3 | `pnpm content draft`         | Claude drafts questions passage by passage; each must quote the passage; saved as `draft`                                     |
| 4, 5 | `/admin/content`             | A reviewer reads each draft beside its passage, then approves (publishes), edits or rejects, one at a time or several at once |
| 6    | `pnpm content translate`     | Drafts translations of published questions; these are reviewed in the admin UI too                                            |
|      | `pnpm content check-sources` | Re-fetches and re-hashes every guide; flags questions whose passage is gone. Runs monthly in CI (`source-check.yml`)          |

`pnpm content help` lists every option; `pnpm content status` shows what is waiting.

## Guards

- **Citations are checked.** A draft whose quote does not appear word for word in its passage is
  discarded before anyone sees it.
- **Duplicates.** A draft with the same wording as an existing question is skipped. A close match
  is saved but flagged for the reviewer, with a link to the other question.
- **Rejected drafts are kept**, hidden, so the same question is recognised if it is drafted again.
- **Source changes do not unpublish anything.** They put the question in the "Source changed"
  queue for a reviewer to confirm, edit or retire.

## Setup

`.env.local` at the repository root (see `.env.example`):

- `DATABASE_URL`: the pipeline connects as the database owner. Server-side only.
- `ANTHROPIC_API_KEY`: for `draft` and `translate`.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`: the reviewers' sign-in at `/admin/sign-in`. It is one
  shared account, to be replaced by per-person reviewer accounts.

Drafting uses `claude-opus-5-5`. A run of 20 questions makes about seven requests.

## Research and draft files

Before anything reaches the database, a country is researched and its content written as files in
`data/` at the repository root.

| Path                                      | What it holds                                                         |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `data/countries/<ISO>.json`               | A `CountryProfile`: one country's test, with a source for each fact   |
| `data/countries/_index.csv`               | Every country researched, one line each, test or no test              |
| `data/sources/<ISO>/sources.json`         | The official material found: address, licence, SHA-256 of each copy   |
| `data/sources/<ISO>/topic_map.md`         | The official topics and the share of the exam each one is             |
| `data/questions/<ISO>/official*.json`     | The government's own questions, where the licence allows copying them |
| `data/questions/<ISO>/original_*.json`    | Questions written from the official material, one file per topic      |
| `data/questions/<ISO>/review.csv`         | A fact-checker's verdict on each question                             |
| `data/questions/<ISO>/i18n/<locale>.json` | Translations, each beside its original                                |
| `data/content/<ISO>/`                     | Flashcards, glossary, exam-day guide, eligibility FAQ, page drafts    |
| `data/schemas/*.schema.json`              | JSON Schema for the JSON files above, generated                       |

The Zod schemas in `src/records.ts` and `src/pack.ts` are the definition. `pnpm content schemas`
writes the JSON Schema files from them, and a test fails if the two are out of step.
`pnpm content validate` checks every file in `data/`; it needs no database, and the test suite runs
it on the repository's own data. Validate with it rather than with the JSON Schema alone: a JSON
Schema cannot say that an answer points at one of its own options, that every fact in a profile is
cited, or that an official question comes from a source whose licence allows copying it.

Three more commands work on these files:

- `pnpm content source-file --country <ISO> --url <address>` downloads one official document into
  `data/sources/<ISO>/` and prints its SHA-256 and size for `sources.json`.
- `pnpm content source-check [--country <ISO>]` downloads every recorded source again and says
  which have changed, keeping a changed one beside the old as `<file>.new`.
- `pnpm content question-stats --country <ISO>` counts a country's questions by topic, difficulty,
  type and style, and lists questions worded alike.

The downloaded documents themselves are not committed (see `.gitignore`): most are not ours to
redistribute, and this repository is public. Their manifest records where each came from and its
hash, so a copy can be fetched again and checked.

A question in a file is `draft` or `needs_review`, never published, with `verified_at: null`.
Review and publishing happen in the app.

## Tests

`pnpm --filter @oathly/content test` runs the unit tests. With `TEST_DATABASE_URL` pointing at the
local database (`pnpm db:start`), it also runs the whole pipeline against it with a stand-in for
Claude. CI does both.

## Audio

`pnpm content audio` records published questions being read aloud, for the
apps' audio mode: for each approved wording of a published question, the
question, its numbered choices, its answer and its explanation.

```sh
pnpm content audio --dry-run          # what is missing; records nothing
pnpm content audio --limit 500        # record up to 500 clips
pnpm content audio --country US --locales es
pnpm content audio --prune            # also delete clips nothing uses any more
```

A clip is named by a hash of its language and its exact words
(`audio_clips.id`). So the command is safe to run again at any time: it
records only what is new, a reworded question gets a new clip, and the same
words used by two questions are recorded once. Run it after publishing or
approving translations (a scheduled job is the simplest way).

It needs a text-to-speech service: `GOOGLE_TTS_API_KEY` (Google Cloud
Text-to-Speech), or `TTS_PROVIDER=macos` to try it with a Mac's own voices.
The service is one small adapter in `src/tts.ts`. Where it has no voice for a
language, or before anything has been recorded, the apps read the same words
with the device's own voice, so audio mode never depends on this having run.

Clips are stored in the database (`audio_clips.data`) and served by the web
app at `/api/audio/<id>` with a year-long cache lifetime.
