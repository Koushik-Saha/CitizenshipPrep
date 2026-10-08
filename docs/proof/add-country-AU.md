# /add-country, run end to end: Australia

Run on 8 October 2026 against an empty local database (`oathly_addcountry`: migrations only, no
seed), so Australia was a new country to it. Nothing here touched the production database or the
database used for manual testing.

## What was added

| Step            | Result                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Country         | `AU`, Australia, English, globe point -35.3, 149.1 (Canberra)                                                                                                      |
| Official topics | Four, in the guide's order: Australia and its people; Australia's democratic beliefs, rights and liberties; Government and the law in Australia; Australian values |
| Exam format     | Australian citizenship test: written, 20 questions, 15 to pass, with a five-question values section in which every answer must be right                            |
| Guide           | _Australian Citizenship: Our Common Bond_ (testable section), Department of Home Affairs, CC BY 4.0: 32 passages                                                   |
| Drafts          | 87 saved of 87 drafted, none discarded, none flagged as duplicates                                                                                                 |
| Translations    | 40 drafts: 20 questions each into Spanish and Arabic                                                                                                               |
| Page            | `/australia/citizenship-test`, showing the format above; `/australia/citizenship-test/australian-values` once a question in it was published                       |
| Globe           | Australia is in the landing page's country list at -35.3, 149.1                                                                                                    |

The time limit was left out: the official page that states it could not be opened, and the command
says to leave a field out rather than guess.

## Coverage per official topic

| Official topic                                               | Drafts |
| ------------------------------------------------------------ | ------ |
| Australia and its people                                     | 20     |
| Australia's democratic beliefs, rights and liberties         | 17     |
| Government and the law in Australia                          | 31     |
| Australian values                                            | 11     |
| _Becoming an Australian citizen_ (not one of the four parts) | 8      |

The drafting model added a fifth topic for the guide's opening pages on the pledge and the test
itself. A reviewer should move those eight into "Australia and its people" or reject them.

## Review

Eight drafts were approved through `/admin/content` (the bulk bar, with the confirmation ticked)
to see the page and the topic page change and to time explanations on them. In this scratch
database only.

## What the run found, and what was fixed

1. **Coordinates south or west of zero were refused.** `--lat -35.3` was read as another option.
   Fixed in the content CLI.
2. **A new country had no topics, so the drafting model invented its own.** On the first attempt
   the guide's "Australian values" part was drafted, but filed under other topics, leaving the
   exam's values section with no questions to draw on. Fixed: a `pnpm content topic` command, and
   the command now enters the guide's own topics before drafting. With them entered, the values
   topic got 11 drafts.
3. **The first twenty drafts all came from the first eight passages.** As the command says to, a
   second pass with a higher limit covered all 32.
4. **The department's site refuses the pipeline's download (HTTP 403).** The documented fallback
   worked: download the file and ingest it with `--file`.

## Not covered

- Only two of the nine other interface languages were translated, and twenty questions each, to
  keep the cost of a proving run down. The command asks for all of them.
- Australia is one of the five seeded countries. The command has still not been run for a country
  the product does not have, against the real content database (checklist item P21).

API use for this run: three drafting passes (about 60 requests) and 40 translations on the
content model, and eight explanations on the app's model.
