# Content audit: the 677 questions waiting for review

12 October 2026. Read from the production database (every question with status `draft` or
`in_review`: all 677 are `in_review`) and checked against the source files stored in
`data/sources/`. Nothing was approved, and, as the last section explains, nothing was rejected.

## Summary

- **677 questions**, all loaded from files on 9 October 2026: 195 official (the government's own
  wording) and 482 written by Oathly from official material.
- **None has no source.** Every question names its source document, where in it to look, and the
  words it rests on.
- **None is flagged as a possible duplicate**, but that flag is only ever set when the drafting
  pipeline writes a question. Loading from files does not run the check, so the zero says nothing.
  Checked here instead: 2 pairs with the same wording and 9 pairs with nearly the same wording.
  All are different questions.
- **Every citation holds.** All 10 cited documents are stored, all 562 cited PDF pages exist, and
  all 677 quoted passages were found where the question says they are.
- **Rejected: 0.** Neither rule (an exact duplicate; a cited page that does not exist) matched
  any question.
- **Coverage is the real gap.** Germany has 67 of 300 general questions and none for the Länder;
  the United Kingdom has no History questions and nothing from the official handbook. Six topics
  or chapters have fewer than 10 questions.

## Counts

### By country and origin

| Country        | Questions | Official | Written by Oathly | Language |
| -------------- | --------- | -------- | ----------------- | -------- |
| United States  | 279       | 128      | 151               | English  |
| Canada         | 168       | 0        | 168               | English  |
| Australia      | 115       | 0        | 115               | English  |
| Germany        | 67        | 67       | 0                 | German   |
| United Kingdom | 48        | 0        | 48                | English  |
| **All**        | **677**   | **195**  | **482**           |          |

### By topic

| Country        | Topic                                    | Questions |
| -------------- | ---------------------------------------- | --------- |
| Australia      | Australia and Its People                 | 27        |
| Australia      | Democratic Beliefs, Rights and Liberties | 21        |
| Australia      | Government and the Law                   | 37        |
| Australia      | Australian Values                        | 30        |
| Canada         | Rights and Responsibilities              | 13        |
| Canada         | History                                  | 68        |
| Canada         | Government and Democracy                 | 45        |
| Canada         | Geography and Symbols                    | 42        |
| Germany        | Politik in der Demokratie                | 55        |
| Germany        | Geschichte und Verantwortung             | **4**     |
| Germany        | Mensch und Gesellschaft                  | **8**     |
| United Kingdom | Government and the Law                   | 45        |
| United Kingdom | History                                  | **0**     |
| United Kingdom | Nations and Traditions                   | **3**     |
| United States  | American Government                      | 154       |
| United States  | American History                         | 101       |
| United States  | Symbols and Holidays                     | 24        |

### By difficulty (1 easiest, 5 hardest)

| Country        | 1   | 2   | 3   | 4   | 5   |
| -------------- | --- | --- | --- | --- | --- |
| United States  | 20  | 149 | 78  | 32  | 0   |
| Canada         | 0   | 50  | 85  | 33  | 0   |
| Australia      | 0   | 33  | 59  | 23  | 0   |
| Germany        | 0   | 32  | 33  | 2   | 0   |
| United Kingdom | 0   | 14  | 24  | 10  | 0   |
| **All**        | 20  | 278 | 279 | 100 | 0   |

Nothing is rated 5, and only the United States has anything rated 1. The app's "easy" filter is
1 to 2 and "hard" is 4 to 5.

### By type

| Country        | Multiple choice | Free response | True or false |
| -------------- | --------------- | ------------- | ------------- |
| United States  | 138             | 128           | 13            |
| Canada         | 162             | 0             | 6             |
| Australia      | 95              | 0             | 20            |
| Germany        | 67              | 0             | 0             |
| United Kingdom | 45              | 0             | 3             |
| **All**        | 507             | 128           | 42            |

The 128 free-response questions are the official US questions, which are asked aloud and have
a list of accepted answers (from 1 to 25 of them). Every multiple-choice question has four
options. Every question has an explanation.

## Sources

| Check                                                               | Result        |
| ------------------------------------------------------------------- | ------------- |
| Questions with no source (no stored passage and no "where to look") | 0             |
| Questions with no quoted words                                      | 0             |
| Questions that name a passage stored in the database                | 0 (see below) |
| Cited documents that are stored in `data/sources/`                  | 10 of 10      |
| Questions citing a PDF page                                         | 562           |
| ... whose cited page exists in the stored PDF                       | 562           |
| ... whose quoted words are on that page                             | 562           |
| Questions citing a web page (Germany 67, United Kingdom 48)         | 115           |
| ... whose quoted words are in the stored page                       | 115           |
| ... United Kingdom: the cited section heading is in the page        | 48 of 48      |
| ... Germany: the question itself is in the stored annex             | 67 of 67      |

The stored documents, and how many questions cite each:

| Country        | Document (file in `data/sources/<country>/`)                                 | Pages | Questions |
| -------------- | ---------------------------------------------------------------------------- | ----- | --------- |
| United States  | Study guide (`USCIS-2025-Civics-Test-Study-Guide.pdf`)                       | 88    | 151       |
| United States  | 128 questions and answers (`2025-Civics-Test-128-Questions-and-Answers.pdf`) | 19    | 128       |
| Canada         | _Discover Canada_ (`discover-canada.pdf`)                                    | 68    | 168       |
| Australia      | _Our Common Bond_, testable part (`our-common-bond-testable.pdf`)            | 50    | 115       |
| Germany        | Annex 1 of the test regulation (`einbtestv.html`)                            | web   | 67        |
| United Kingdom | How government works (`how-government-works.html`)                           | web   | 20        |
| United Kingdom | Elections in the UK (`elections-in-the-uk.html`)                             | web   | 15        |
| United Kingdom | Jury service (`jury-service.html`)                                           | web   | 7         |
| United Kingdom | How your council works (`how-your-council-works.html`)                       | web   | 3         |
| United Kingdom | Bank holidays (`bank-holidays.html`)                                         | web   | 3         |

**No passage is stored in the database for any of them.** The source files are on the machine
that built the question files, not in the database, so the review page shows each question's
quote and "where to look" but not the passage around it. Loading a document with
`pnpm content ingest` fixes that for its questions.

**24 questions are marked "the answer changes over time"** (an officeholder or a figure): United
States 11, United Kingdom 9, Australia 2, Canada 2. Each needs its answer checked on the day it
is approved, whatever the stored file says.

## Duplicates

**Flagged by the app: 0.** The "possible duplicate" flag is set in one place, when the drafting
pipeline writes a question (`packages/content/src/pipeline/draft.ts`). Questions loaded from files
(`import-questions`) are not compared with anything, so no flag is not evidence of no duplicates.
That is worth fixing in the loader.

Compared here, each country's questions against each other, with the app's own measure:

**Same wording, once case and punctuation are ignored: 2 pairs. Neither is a duplicate.**

| Country | Questions                | Wording                                                          | Why they are two questions                                                       |
| ------- | ------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Germany | Official no. 107 and 110 | „Für wie viele Jahre wird der Bundestag in Deutschland gewählt?“ | Different options in the official catalogue (2, 4, 6, 8 years; 2, 3, 4, 5 years) |
| Germany | Official no. 26 and 27   | „Deutschland ist …“                                              | Different options and different right answers                                    |

**Nearly the same wording (0.82 or more on the app's scale): 9 pairs. All ask different things.**

| Country       | Pair                                                                             | Same answer?            |
| ------------- | -------------------------------------------------------------------------------- | ----------------------- |
| United States | Official 101 and 106: why the US entered World War I / World War II              | No                      |
| United States | Official 38 and 39: the name of the President / the Vice President now           | No                      |
| United States | Official 91 and 100: one war fought in the 1800s / the 1900s                     | No                      |
| United States | Official 98 and 102: when all men / all women got the right to vote              | No                      |
| United States | Official 110 and 111: why the US entered the Korean War / the Vietnam War        | Yes, as published       |
| United States | Two written by Oathly: on the flag, what blue / red is a symbol for              | No                      |
| Germany       | Official 143 and 144: „Ein Richter / eine Richterin gehört in Deutschland zur …“ | Same idea, two wordings |
| Germany       | Official 81 and 83: who elects the Chancellor                                    | Yes, as published       |
| Australia     | Two written by Oathly: the largest / the smallest state                          | No                      |

The official pairs are the governments' own, and a learner can be asked either. The Oathly pairs
ask about different things.

## Coverage against each country's topic list

A topic or chapter with fewer than 10 questions is in **bold**.

### United States: complete for the official questions

All 128 official questions are present, numbers 1 to 128 with none missing, and each sits under
the topic the official list puts it in.

| Topic                | Official section                               | Official questions | Written by Oathly, in the topic | Share of the bank | Share of the test (estimate) |
| -------------------- | ---------------------------------------------- | ------------------ | ------------------------------- | ----------------- | ---------------------------- |
| American Government  | A: Principles of American Government (1 to 15) | 15                 |                                 |                   |                              |
| American Government  | B: System of Government (16 to 62)             | 47                 |                                 |                   |                              |
| American Government  | C: Rights and Responsibilities (63 to 72)      | 10                 | 82                              | 55.2%             | 56.2%                        |
| American History     | A: Colonial Period and Independence (73 to 89) | 17                 |                                 |                   |                              |
| American History     | B: 1800s (90 to 99)                            | 10                 |                                 |                   |                              |
| American History     | C: Recent American History (100 to 118)        | 19                 | 55                              | 36.2%             | 35.9%                        |
| Symbols and Holidays | A: Symbols (119 to 124)                        | **6**              |                                 |                   |                              |
| Symbols and Holidays | B: Holidays (125 to 128)                       | **4**              | 14                              | 8.6%              | 7.8%                         |

The two short sections are short in the official list itself: there are only six questions on
symbols and four on holidays. The questions written by Oathly come from the study guide's
chapters 1 to 12, and five of those have fewer than 10: chapter 6 (**2**), chapter 10 (**7**),
chapter 7 (**8**), chapter 9 (**8**) and chapter 8 (**9**).

### Canada: two thin chapters

Canada publishes no official questions and no weights; the shares of the test are estimates from
the length of each chapter (`data/sources/CA/topic_map.md`).

| Topic                       | Chapter of _Discover Canada_               | Questions | Topic's share of the bank | Share of the test (estimate) |
| --------------------------- | ------------------------------------------ | --------- | ------------------------- | ---------------------------- |
| Rights and Responsibilities | Rights and Responsibilities of Citizenship | 13        | 7.7%                      | 4.6%                         |
| History                     | Who We Are                                 | 14        |                           |                              |
| History                     | Canada's History                           | 41        |                           |                              |
| History                     | Modern Canada                              | 13        | 40.5%                     | 47.9%                        |
| Government and Democracy    | How Canadians Govern Themselves            | 23        |                           |                              |
| Government and Democracy    | Federal Elections                          | 14        |                           |                              |
| Government and Democracy    | The Justice System                         | **8**     | 26.8%                     | 20.0%                        |
| Geography and Symbols       | Canadian Symbols                           | 14        |                           |                              |
| Geography and Symbols       | Canada's Economy                           | **5**     |                           |                              |
| Geography and Symbols       | Canada's Regions                           | 23        | 25.0%                     | 27.4%                        |

History is under-weighted against its estimated share of the test. The guide is also out of
date in places (it names Queen Elizabeth II as Sovereign), which the topic map records.

### Australia: covered

| Topic                                    | Part of _Our Common Bond_ | Questions | Share of the bank | Share of the test |
| ---------------------------------------- | ------------------------- | --------- | ----------------- | ----------------- |
| Australia and Its People                 | Part 1                    | 27        | 23.5%             | 24.2% (estimate)  |
| Democratic Beliefs, Rights and Liberties | Part 2                    | 21        | 18.3%             | 18.6% (estimate)  |
| Government and the Law                   | Part 3                    | 37        | 32.2%             | 32.2% (estimate)  |
| Australian Values                        | Part 4                    | 30        | 26.1%             | 25.0% (published) |

Every question's topic matches the part of the booklet it cites. The test asks five questions
on Australian values and all five must be right; 30 gives six different sets.

### Germany: a fraction of the catalogue

The official catalogue has 300 general questions and 10 for each of the 16 Länder (160). A test
is 30 general questions and 3 from the applicant's Land.

| Topic                        | Questions | Of                                    |
| ---------------------------- | --------- | ------------------------------------- |
| Politik in der Demokratie    | 55        |                                       |
| Geschichte und Verantwortung | **4**     |                                       |
| Mensch und Gesellschaft      | **8**     | 67 of the 300 general questions (22%) |
| The applicant's Land         | **0**     | 0 of 160                              |

Only questions whose answer could be established from the text of the law were loaded, because
no official answer key is published under a licence that allows reuse. That is why politics is
well covered and history and society are not. A learner cannot prepare for the German test
from 67 questions, and nobody can practise the three Land questions at all.

### United Kingdom: not yet a preparation for the test

| Topic                  | Questions | From                                                             |
| ---------------------- | --------- | ---------------------------------------------------------------- |
| Government and the Law | 45        | Four GOV.UK pages: government, elections, jury service, councils |
| History                | **0**     | Nothing                                                          |
| Nations and Traditions | **3**     | One GOV.UK page: bank holidays                                   |

The Life in the UK test is set from the official handbook, which is sold, not published openly,
and is not among the stored sources. These 48 questions come from GOV.UK pages on subjects the
handbook also covers. They are sound as far as they go, but they are not written from the
handbook, there is no History at all, and the weights are not known.

## Rejected: none

Both rules were applied to all 677 questions. Neither matched any, so the database was not
changed.

| Rule                                                           | Checked                                                                                                                                          | Matched |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| An exact duplicate of another question                         | Same country, same wording once case and punctuation are ignored (the app's own test), then the options and the right answer                     | 0       |
| The cited source page does not exist in the stored source file | The stored file exists; for a PDF, the cited page number is within the file; for a web page, the cited section or question number is in the file | 0       |

Two pairs share their wording (Germany, official 107 and 110, and 26 and 27). They were **not**
rejected: each is two separate questions in the official catalogue with different options, and a
learner can be asked either. Say so if you want one of each pair removed anyway.

## Other things the numbers show

None of these was asked for, and none was acted on.

- **Where the right answer sits.** In questions written by Oathly the right answer is not evenly
  spread everywhere. United Kingdom: option c is right in 18 of 45 (40%) and d in 7. United
  States: c in 46 of 138 (33%), d in 24 (17%). Canada and Australia are even. A learner who
  notices can guess; worth evening out before publishing. Germany's spread (b in 26 of 67) is
  the official catalogue's own.
- **True or false.** Canada has 5 "true" and 1 "false"; the United Kingdom has 3 "false" and no
  "true". Australia (10 and 10) and the United States (6 and 7) are balanced.
- **Loading from files skips the duplicate check** (see Duplicates).
- **The fact-check of these questions was made in the session that wrote them.** This audit
  confirms that every quote is where the question says it is. It does not confirm that each
  answer follows from its quote: that is the reviewer's decision, one question at a time.

## How this was checked

- The questions, topics and exam formats were read from production in one pass; nothing was
  written.
- PDF text was taken from each stored file three ways (reading order, raw order, page layout),
  with words broken across lines rejoined, and a quote counted as found when its letters and
  digits appear in order on the cited page in any of them. A first pass that did not allow for
  columns and line breaks missed 156 quotes that are in fact there.
- Australia's questions give two page numbers, the booklet's and the file's ("page 31 (page 33
  of the PDF)"); the file's was used. The other PDFs' page numbers are the file's own.
- Duplicates were compared within a country, not across countries.
- Limits: the stored files are copies recorded as downloaded on 9 October 2026. Whether the live
  documents have changed since is the monthly source check's job, not this audit's.
