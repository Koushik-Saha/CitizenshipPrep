# Store listing text

Text for the App Store and Google Play, ready to paste. Anything in
`[square brackets]` is yours to fill in. Limits are the stores' own; each line
below is within its limit.

Two rules run through all of it, because both stores enforce them for apps
about government services:

- Never say or imply that Oathly is official, or connected to any government.
- Say where the information comes from, with links.

## Both stores

| Field                                   | Text                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| App name                                | Oathly: Citizenship Test Prep                                                   |
| Category                                | Education                                                                       |
| Support URL                             | `https://[your-domain]/delete-account` until you have a support page; then that |
| Marketing URL                           | `https://[your-domain]`                                                         |
| Privacy policy URL                      | `https://[your-domain]/privacy`                                                 |
| Terms URL                               | `https://[your-domain]/terms`                                                   |
| Account deletion URL (Play asks for it) | `https://[your-domain]/delete-account`                                          |
| Copyright                               | `[year] [your name or company]`                                                 |

## App Store

**Subtitle** (30 characters)

```
Practice questions, explained
```

**Promotional text** (170 characters; can be changed without a new version)

```
Practise for your citizenship test with questions checked against the official study guide, answers explained in plain language, and an estimate of how ready you are.
```

**Keywords** (100 characters, comma separated, no spaces)

```
citizenship,test,naturalization,civics,exam,practice,quiz,immigration,study,flashcards,mock exam
```

**Description**

```
Oathly helps you prepare for your citizenship test.

Every practice question is written from the country's official study material, checked against it by a reviewer, and linked to its source. You see what you got wrong, why the right answer is right, and how ready you are for the day.

WHAT YOU GET
• Practice questions for your country's test, by topic or mixed
• Mock exams with the real test's number of questions, pass mark and time limit
• Answers explained in plain language, with the source to check
• A readiness estimate that tells you what to work on next
• Review that brings questions back just before you forget them
• Audio mode, and spoken answers for tests that are taken aloud
• Study in your own language where a reviewed translation exists
• Works offline: save a country to your phone
• Your progress on your phone and on the web

COUNTRIES
[List the countries you have published, e.g. "United States, Canada, United Kingdom". Only list countries whose questions are live.]

PLANS
Oathly is free to start, with a sample of each country's questions. Pro (monthly or yearly) opens every question and mock exam, and gives you more AI help. A Country Pass opens one country for a single payment. Subscriptions renew automatically until cancelled; manage or cancel them in your Apple ID settings.

IMPORTANT
Oathly is an independent study app. It is not affiliated with, or endorsed by, any government or government agency. It cannot book your test, and it is not legal advice. Always check the rules that apply to you on the official website. Sources for each country's test are linked in the app and at https://[your-domain]/countries.

Privacy policy: https://[your-domain]/privacy
Terms of use: https://[your-domain]/terms
```

**App Review notes**

```
Oathly is an independent citizenship test study app. It is not affiliated with any government; this is stated on the first screen, in the description and in the terms.

Sign-in is by a code sent to an email address. [Say here how the reviewer signs in: see "A sign-in for App Review" in docs/launch.md. This has to be solved before you submit.]

Account deletion: Profile tab > Delete your account.
Subscriptions are sold through in-app purchase (RevenueCat).
The microphone is used only when the learner chooses to answer a question aloud. Speech is turned into text by the device's own speech recognition; Oathly receives the text and keeps no audio.
```

**Age rating:** answer "None" to every content question. The result is 4+.

**App Privacy** (App Store Connect > App Privacy). These match the privacy
manifest in `apps/mobile/app.json` and `/privacy`:

| Data                                               | Collected | Linked to the user | Used for tracking | Purpose                      |
| -------------------------------------------------- | --------- | ------------------ | ----------------- | ---------------------------- |
| Contact info: email address                        | Yes       | Yes                | No                | App functionality            |
| Contact info: name                                 | Yes       | Yes                | No                | App functionality            |
| Identifiers: user ID                               | Yes       | Yes                | No                | App functionality, analytics |
| Purchases: purchase history                        | Yes       | Yes                | No                | App functionality            |
| Usage data: product interaction                    | Yes       | Yes                | No                | App functionality, analytics |
| User content: other user content (tutor questions) | Yes       | Yes                | No                | App functionality            |
| Diagnostics: crash data                            | Yes       | No                 | No                | App functionality            |

Everything else: not collected. "Do you or your partners use data for
tracking?": No.

## Google Play

**Short description** (80 characters)

```
Citizenship test practice with checked questions, explanations and mock exams.
```

**Full description**

```
Oathly helps you prepare for your citizenship test.

Every practice question is written from the country's official study material, checked against it by a reviewer, and linked to its source. You see what you got wrong, why the right answer is right, and how ready you are for the day.

WHAT YOU GET
• Practice questions for your country's test, by topic or mixed
• Mock exams with the real test's number of questions, pass mark and time limit
• Answers explained in plain language, with the source to check
• A readiness estimate that tells you what to work on next
• Review that brings questions back just before you forget them
• Audio mode, and spoken answers for tests that are taken aloud
• Study in your own language where a reviewed translation exists
• Works offline: save a country to your phone
• Your progress on your phone and on the web

COUNTRIES
[List the countries you have published. Only list countries whose questions are live.]

PLANS
Oathly is free to start, with a sample of each country's questions. Pro (monthly or yearly) opens every question and mock exam, and gives you more AI help. A Country Pass opens one country for a single payment. Subscriptions renew automatically until cancelled; manage or cancel them in Google Play.

DISCLAIMER
Oathly is an independent study app. It does not represent any government entity, and is not affiliated with or endorsed by any government or government agency. It cannot book your test and is not legal advice.

SOURCES
The information in Oathly comes from each country's official study material and test information, linked in the app next to every exam and question, and listed at https://[your-domain]/countries.
[List the official source for each country you have published, one per line, e.g. "United States: https://www.uscis.gov/citizenship". Play asks for the links in the description itself.]

Privacy policy: https://[your-domain]/privacy
Delete your account: https://[your-domain]/delete-account
```

**Data safety** (Play Console > App content > Data safety):

- Does your app collect or share any of the required user data types? **Yes.**
- Is all of the user data collected by your app encrypted in transit? **Yes.**
- Do you provide a way for users to request that their data is deleted? **Yes**
  (in the app, and at `https://[your-domain]/delete-account`).

| Data type                                                    | Collected | Shared | Required or optional | Purposes                     |
| ------------------------------------------------------------ | --------- | ------ | -------------------- | ---------------------------- |
| Personal info: email address                                 | Yes       | No     | Required             | Account management           |
| Personal info: name                                          | Yes       | No     | Optional             | Account management           |
| Personal info: user IDs                                      | Yes       | No     | Required             | App functionality, analytics |
| Financial info: purchase history                             | Yes       | No     | Optional             | App functionality            |
| App activity: app interactions                               | Yes       | No     | Required             | App functionality, analytics |
| App activity: other user-generated content (tutor questions) | Yes       | No     | Optional             | App functionality            |
| App info and performance: crash logs                         | Yes       | No     | Required             | Analytics                    |

Passing data to a service provider that processes it for you (Neon, Vercel,
Anthropic, Sentry, PostHog) is not "sharing" in Play's sense.

**Content rating:** the questionnaire's category is "Reference, News, or
Educational". Answer No to every content question.

**Target audience:** 16 and over (the terms say so). Not designed for
children.

**Government apps declaration** (App content): Oathly is not a government
app. Declare that it provides information from government sources, without
affiliation, and that the description carries the disclaimer and the sources
(it does, above).
