# @oathly/i18n

The words both apps show, in every language they come in, plus the helpers
around them. Shared by the web app and the phone app.

## Two kinds of language

- **UI languages** (`uiLocales` in `src/locales.ts`): what buttons, headings
  and messages are written in. English, Spanish, Hindi, Bengali, Arabic,
  Chinese (Simplified), Tagalog, Vietnamese, Portuguese and French.
- **Study languages** (`studyLocales` in `src/index.ts`): what a question can
  be translated into. There are more of these, and they are data: a question
  appears in a study language once an approved row exists in
  `question_translations`.

A learner can read the app in one language and study in another.

## Messages

`src/messages/en.ts` is the source. Every other file in that folder is typed
against it, so a missing or extra key is a type error. Messages use a small
subset of ICU MessageFormat:

```
Study for {country}
{count, plural, one {# question} other {# questions}}
{count, plural, =1 {Exam tomorrow} other {Exam in # days}}
```

`src/messages.test.ts` checks every language against English: the same
placeholders, an `other` form on every plural, and only plural forms the
language really has.

Text from somewhere else (a question, a quote from a guide, a topic name)
goes through `isolate()` before it is put into a message, so English inside
an Arabic sentence keeps its own direction.

## Adding a language

1. Add its code to `uiLocales` in `src/locales.ts`.
2. Copy `src/messages/en.ts` to `src/messages/<code>.ts` and translate it.
3. Add it to `catalogs` in `src/messages/index.ts`.
4. If it reads right to left, add it to `textDirection` in `src/index.ts`.

The web app then serves it under `/<code>/…` and both apps list it in their
language menus. Nothing else names a language.

## Status of the translations

The nine translations were drafted by AI and have not yet been reviewed by
native speakers. Have each one checked before it is relied on.
