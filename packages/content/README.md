# @oathly/content

The content pipeline: official study guides in, reviewed questions out. A CLI drives it and the
admin UI at `/admin/content` is where people review what it produces.

Nothing the pipeline writes is visible to learners. A question is published only when a reviewer
approves it, which records who verified it and when.

## The pipeline

| Step | Command                      | What happens                                                                                                         |
| ---- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1    | `pnpm content ingest`        | Fetches a guide (PDF, web page or file), stores it as hashed passages                                                |
| 2, 3 | `pnpm content draft`         | Claude drafts questions passage by passage; each must quote the passage; saved as `draft`                            |
| 4, 5 | `/admin/content`             | A reviewer reads each draft beside its passage, then approves (publishes), edits or rejects                          |
| 6    | `pnpm content translate`     | Drafts translations of published questions; these are reviewed in the admin UI too                                   |
|      | `pnpm content check-sources` | Re-fetches and re-hashes every guide; flags questions whose passage is gone. Runs monthly in CI (`source-check.yml`) |

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
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`: the interim sign-in for `/admin`. It is one shared account
  over HTTP Basic auth, to be replaced when real sign-in exists.

Drafting uses `claude-opus-5-5`. A run of 20 questions makes about seven requests.

## Tests

`pnpm --filter @oathly/content test` runs the unit tests. With `TEST_DATABASE_URL` pointing at the
local database (`pnpm db:start`), it also runs the whole pipeline against it with a stand-in for
Claude. CI does both.
