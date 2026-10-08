import { existsSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { ExamFormatError, parseBlueprint } from '@oathly/core';

import { createClaudeModel } from './claude';
import { createPool } from './db';
import { validateDataFiles, writeJsonSchemas } from './data-files';
import { slugify } from './text';
import { questionStats } from './question-stats';
import { recheckSourceFiles, saveSourceFile, type SourceRecheck } from './source-files';
import { loadEnv, repoRoot } from './env';
import { checkSources } from './pipeline/check-sources';
import { draftQuestions } from './pipeline/draft';
import { ingestSource } from './pipeline/ingest';
import { describeNotify, notifyContentChanged } from './notify';
import { recordAudio } from './pipeline/audio';
import { translateQuestions } from './pipeline/translate';
import { listDocuments, upsertCountry, upsertExamFormat, upsertTopic } from './repository';
import { getQueueCounts, getTopicCoverage } from './review';
import { fetchSource, readSourceFile } from './source';
import { createSpeaker, type Speaker } from './tts';

const USAGE = `Oathly content pipeline

Usage: pnpm content <command> [options]

  country        Add or update a country
                 --iso US --name "United States" --languages en[,fr] [--no-exam]
                 [--lat 39.8 --lng -98.6]   (a point inside the country, for the globe)

  topic          Add or rename one of the guide's own topics. Do this before drafting:
                 drafts are filed under the topics that exist
                 --country US --slug american-government --name "American Government" [--order 1]

  exam-format    Add or update an exam format for a country
                 --country US --slug civics --name "Civics test" --type written|oral|interview|language
                 --source-url https://... [--questions 20] [--pass 12] [--minutes 45] [--pool 128]
                 [--notes "..."] [--blueprint '{"sections": [...], "stopEarly": false}']
                 (the blueprint describes sections and special pass rules; see
                 parseBlueprint in packages/core)

  ingest         Store an official study guide and split it into passages
                 --country US --title "..." --license public-domain
                 (--url https://... | --file guide.pdf --source-url https://...)
                 [--publisher "..."] [--locale en]

  draft          Draft questions from a stored guide; they enter the review queue as drafts
                 --document <id> [--limit 20] [--per-passage 3]

  translate      Draft translations of published questions; they need review too
                 --country US --locales es,bn [--limit 100] [--include-unpublished]

  check-sources  Re-fetch every source, re-hash it, and flag questions whose passage changed
                 [--country US]

  audio          Record published questions being read aloud, for audio mode. Records only
                 what is missing, so it is safe to run again after publishing or translating
                 [--country US] [--locales es,bn] [--limit 500] [--dry-run]
                 [--prune]   (also delete clips no published question uses any more)

  schemas        Write the JSON Schema files for data/ (data/schemas), from the Zod schemas

  source-file    Download one official document into data/sources/<ISO>/ and print its
                 SHA-256, size and file name for sources.json
                   --country --url [--name file.pdf]

  source-check   Download every source in sources.json again and say which have changed.
                 A changed one is saved beside the old as <file>.new
                   [--country]

  question-stats Count a country's question files by topic, difficulty, type and style,
                 and list questions worded alike
                   --country

  validate       Check every file in data/ against its schema: country profiles, their
                 index, and question files. Needs no database

  status         Show sources and what is waiting for review
                 [--country US]   (with a country: also its questions by topic)

Reads DATABASE_URL and ANTHROPIC_API_KEY from .env.local at the repository root.
"audio" needs a text-to-speech service: GOOGLE_TTS_API_KEY, or TTS_PROVIDER=macos to try it
with this Mac's own voices.
With SITE_URL and REVALIDATE_SECRET set, changes refresh the site's public pages at once.
Review drafts at /admin/content in the web app.`;

class UsageError extends Error {}

function required(values: Record<string, unknown>, name: string): string {
  const value = values[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new UsageError(`Missing --${name}.`);
  }
  return value.trim();
}

function optional(values: Record<string, unknown>, name: string): string | null {
  const value = values[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function wholeNumber(values: Record<string, unknown>, name: string): number | null {
  const value = optional(values, name);
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new UsageError(`--${name} must be a whole number above zero.`);
  }
  return parsed;
}

function countryCode(values: Record<string, unknown>, name: string): string {
  const code = required(values, name).toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    throw new UsageError(`--${name} must be a two-letter ISO country code.`);
  }
  return code;
}

function coordinates(values: Record<string, unknown>): { latitude?: number; longitude?: number } {
  const lat = optional(values, 'lat');
  const lng = optional(values, 'lng');
  if (lat == null && lng == null) return {};
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (lat == null || lng == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new UsageError('Give both --lat and --lng, in degrees.');
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new UsageError('--lat must be within ±90 and --lng within ±180.');
  }
  return { latitude, longitude };
}

function httpsUrl(values: Record<string, unknown>, name: string): string {
  const url = required(values, name);
  if (!url.startsWith('https://')) throw new UsageError(`--${name} must be an https:// URL.`);
  return url;
}

/** For --dry-run, which records nothing and so needs no speech service. */
const silentSpeaker: Speaker = {
  name: 'none',
  speak: () => Promise.reject(new Error('A dry run records nothing.')),
};

/**
 * "--lat -35.3" as "--lat=-35.3": the argument parser takes a value that
 * starts with a dash for another option, and half the world's coordinates do.
 */
function withSignedNumbers(args: readonly string[]): string[] {
  const joined: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const next = args[i + 1];
    if (/^--[a-z-]+$/.test(args[i]!) && next !== undefined && /^-\d/.test(next)) {
      joined.push(`${args[i]}=${next}`);
      i += 1;
    } else {
      joined.push(args[i]!);
    }
  }
  return joined;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help') {
    console.log(USAGE);
    return;
  }

  const { values } = parseArgs({
    args: withSignedNumbers(rest),
    strict: true,
    options: {
      iso: { type: 'string' },
      name: { type: 'string' },
      languages: { type: 'string' },
      'no-exam': { type: 'boolean' },
      lat: { type: 'string' },
      lng: { type: 'string' },
      country: { type: 'string' },
      slug: { type: 'string' },
      order: { type: 'string' },
      type: { type: 'string' },
      'source-url': { type: 'string' },
      questions: { type: 'string' },
      pass: { type: 'string' },
      minutes: { type: 'string' },
      pool: { type: 'string' },
      notes: { type: 'string' },
      blueprint: { type: 'string' },
      title: { type: 'string' },
      publisher: { type: 'string' },
      license: { type: 'string' },
      locale: { type: 'string' },
      url: { type: 'string' },
      file: { type: 'string' },
      document: { type: 'string' },
      limit: { type: 'string' },
      'per-passage': { type: 'string' },
      locales: { type: 'string' },
      'include-unpublished': { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      prune: { type: 'boolean' },
    },
  });

  // The data folder's own commands: no database, no keys.
  const dataDir = resolve(repoRoot, 'data');
  if (command === 'schemas') {
    for (const file of writeJsonSchemas(dataDir)) console.log(`Wrote ${relative(repoRoot, file)}`);
    return;
  }
  if (command === 'source-file') {
    const saved = await saveSourceFile(
      dataDir,
      countryCode(values, 'country'),
      required(values, 'url'),
      {
        name: optional(values, 'name'),
      },
    );
    // What sources.json records about the copy: paste it into the entry.
    console.log(JSON.stringify(saved, null, 2));
    return;
  }
  if (command === 'source-check') {
    const only = optional(values, 'country')?.toUpperCase();
    const folder = resolve(dataDir, 'sources');
    const countries = (existsSync(folder) ? readdirSync(folder) : [])
      .filter((name) => /^[A-Z]{2}$/.test(name) && (!only || name === only))
      .sort();
    const changed: SourceRecheck[] = [];
    for (const iso of countries) {
      for (const check of await recheckSourceFiles(dataDir, iso)) {
        console.log(`${check.iso}  ${check.result.padEnd(14)} ${check.id}  ${check.detail}`);
        if (check.result !== 'same') changed.push(check);
      }
    }
    console.log(
      `${countries.length} pack(s) checked; ${changed.length} source(s) not confirmed the same.`,
    );
    if (changed.length > 0) console.log(JSON.stringify(changed, null, 2));
    return;
  }
  if (command === 'question-stats') {
    console.log(JSON.stringify(questionStats(dataDir, countryCode(values, 'country')), null, 2));
    return;
  }
  if (command === 'validate') {
    const report = validateDataFiles(dataDir);
    console.log(
      `${report.profiles} country profile(s), ${report.indexRows} index line(s), ${report.sources} source(s), ${report.questions} question(s), ${report.reviewed} reviewed, ${report.translations} translation(s), ${report.flashcards} flashcard(s).`,
    );
    if (report.problems.length === 0) {
      console.log('All valid.');
      return;
    }
    for (const problem of report.problems) console.error(`  ${problem}`);
    console.error(`${report.problems.length} problem(s).`);
    process.exitCode = 1;
    return;
  }

  loadEnv();
  const pool = createPool();
  try {
    switch (command) {
      case 'country': {
        const isoCode = countryCode(values, 'iso');
        await upsertCountry(pool, {
          isoCode,
          name: required(values, 'name'),
          hasExam: !values['no-exam'],
          examLanguages: required(values, 'languages')
            .split(',')
            .map((language) => language.trim())
            .filter(Boolean),
          ...coordinates(values),
        });
        console.log(`Saved country ${isoCode}.`);
        console.log(describeNotify(await notifyContentChanged({ countryCode: isoCode })));
        break;
      }

      case 'topic': {
        const country = countryCode(values, 'country');
        const slug = required(values, 'slug');
        if (slug !== slugify(slug)) {
          throw new UsageError('--slug is lowercase words joined by hyphens.');
        }
        const order = optional(values, 'order');
        if (order !== null && !/^\d+$/.test(order)) {
          throw new UsageError("--order is a whole number: the topic's place in the guide.");
        }
        await upsertTopic(pool, country, {
          slug,
          name: required(values, 'name'),
          ...(order === null ? {} : { sortOrder: Number(order) }),
        });
        console.log(`Saved topic ${country}/${slug}.`);
        break;
      }

      case 'exam-format': {
        const type = required(values, 'type');
        if (type !== 'written' && type !== 'oral' && type !== 'interview' && type !== 'language') {
          throw new UsageError('--type must be written, oral, interview or language.');
        }
        const country = countryCode(values, 'country');
        const slug = required(values, 'slug');
        const blueprintJson = optional(values, 'blueprint');
        let blueprint: Record<string, unknown> | null = null;
        if (blueprintJson) {
          try {
            blueprint = JSON.parse(blueprintJson) as Record<string, unknown>;
            parseBlueprint(blueprint);
          } catch (error) {
            throw new UsageError(
              error instanceof ExamFormatError ? error.message : '--blueprint must be valid JSON.',
            );
          }
        }
        await upsertExamFormat(pool, {
          countryCode: country,
          slug,
          name: required(values, 'name'),
          formatType: type,
          questionCount: wholeNumber(values, 'questions'),
          passMark: wholeNumber(values, 'pass'),
          timeLimitMinutes: wholeNumber(values, 'minutes'),
          questionPoolSize: wholeNumber(values, 'pool'),
          notes: optional(values, 'notes'),
          sourceUrl: httpsUrl(values, 'source-url'),
          blueprint,
        });
        console.log(`Saved exam format ${country}/${slug}. It is not marked as verified.`);
        console.log(describeNotify(await notifyContentChanged({ countryCode: country })));
        break;
      }

      case 'ingest': {
        const url = optional(values, 'url');
        const file = optional(values, 'file');
        if ((url == null) === (file == null)) {
          throw new UsageError('Give exactly one of --url or --file.');
        }
        const sourceUrl = url ? httpsUrl(values, 'url') : httpsUrl(values, 'source-url');
        const source = url ? await fetchSource(sourceUrl) : await readSourceFile(file!);
        const result = await ingestSource(pool, {
          countryCode: countryCode(values, 'country'),
          title: required(values, 'title'),
          publisher: optional(values, 'publisher'),
          sourceUrl,
          locale: optional(values, 'locale') ?? 'en',
          license: required(values, 'license'),
          isRefetchable: url != null,
          source,
        });
        if (result.outcome === 'new') {
          console.log(`Stored the guide as ${result.passagesAdded} passages.`);
        } else if (result.outcome === 'unchanged') {
          console.log('This guide is already stored and has not changed.');
        } else {
          console.log(
            `The guide changed: ${result.passagesAdded} passages added, ` +
              `${result.passagesRemoved} removed, ${result.questionsFlagged} questions flagged.`,
          );
        }
        console.log(`Document id: ${result.documentId}`);
        break;
      }

      case 'draft': {
        const summary = await draftQuestions(pool, createClaudeModel(), {
          documentId: required(values, 'document'),
          limit: wholeNumber(values, 'limit') ?? 20,
          perPassage: wholeNumber(values, 'per-passage') ?? 3,
          log: (message) => console.log(message),
        });
        console.log(
          `\nSaved ${summary.saved} draft question(s) from ${summary.passagesRead} passage(s).`,
        );
        if (summary.possibleDuplicates > 0) {
          console.log(`${summary.possibleDuplicates} flagged as possible duplicates.`);
        }
        if (summary.exactDuplicates > 0) {
          console.log(`${summary.exactDuplicates} skipped: same wording as an existing question.`);
        }
        for (const discarded of summary.discarded) {
          console.log(`Discarded "${discarded.question}": ${discarded.problems.join('; ')}`);
        }
        break;
      }

      case 'translate': {
        const summary = await translateQuestions(pool, createClaudeModel(), {
          countryCode: countryCode(values, 'country'),
          locales: required(values, 'locales')
            .split(',')
            .map((locale) => locale.trim())
            .filter(Boolean),
          includeUnpublished: values['include-unpublished'] ?? false,
          limit: wholeNumber(values, 'limit') ?? 100,
          log: (message) => console.log(message),
        });
        console.log(`\nSaved ${summary.saved} draft translation(s).`);
        for (const discarded of summary.discarded) {
          console.log(
            `Discarded ${discarded.locale} for ${discarded.questionId}: ` +
              discarded.problems.join('; '),
          );
        }
        break;
      }

      case 'check-sources': {
        const country = optional(values, 'country')?.toUpperCase();
        const results = await checkSources(pool, { countryCode: country });
        let failed = false;
        for (const result of results) {
          if (result.error) {
            failed = true;
            console.log(`ERROR      ${result.title}: ${result.error}`);
          } else if (result.update?.outcome === 'changed') {
            console.log(
              `CHANGED    ${result.title}: ${result.update.passagesRemoved} passage(s) removed, ` +
                `${result.update.passagesAdded} added, ` +
                `${result.update.questionsFlagged} question(s) flagged for review`,
            );
          } else {
            console.log(`unchanged  ${result.title}`);
          }
        }
        if (results.length === 0) console.log('No sources to check.');
        // Flagged questions leave the public pages until a reviewer checks them.
        if (results.some((result) => (result.update?.questionsFlagged ?? 0) > 0)) {
          console.log(describeNotify(await notifyContentChanged({ countryCode: country })));
        }
        // A source that cannot be fetched needs a person to look at it.
        if (failed) process.exitCode = 1;
        break;
      }

      case 'audio': {
        const dryRun = values['dry-run'] ?? false;
        const summary = await recordAudio(pool, dryRun ? silentSpeaker : createSpeaker(), {
          countryCode: optional(values, 'country')?.toUpperCase(),
          locales: optional(values, 'locales')
            ?.split(',')
            .map((locale) => locale.trim())
            .filter(Boolean),
          limit: wholeNumber(values, 'limit') ?? undefined,
          dryRun,
          prune: values.prune ?? false,
          log: (message) => console.log(message),
        });
        console.log(`Clips the published questions need: ${summary.needed}`);
        console.log(`Already recorded: ${summary.existing}`);
        if (!dryRun) {
          console.log(`Recorded now: ${summary.recorded} (${summary.characters} characters)`);
        }
        console.log(`Still to record: ${summary.remaining}`);
        if (summary.noVoice.length > 0) {
          console.log(
            `No voice for: ${summary.noVoice.join(', ')}. The apps read these with the device’s own voice.`,
          );
        }
        if (summary.pruned > 0) console.log(`Deleted ${summary.pruned} clip(s) no longer used.`);
        for (const failure of summary.failed.slice(0, 10)) {
          console.log(`FAILED  ${failure.locale}  "${failure.text}": ${failure.error}`);
        }
        if (summary.failed.length > 10) console.log(`…and ${summary.failed.length - 10} more.`);
        if (summary.failed.length > 0) process.exitCode = 1;
        break;
      }

      case 'status': {
        const country = optional(values, 'country')?.toUpperCase();
        const documents = await listDocuments(pool, { countryCode: country });
        const counts = await getQueueCounts(pool, country);
        console.log(`Sources: ${documents.length}`);
        for (const document of documents) {
          console.log(`  ${document.countryCode}  ${document.id}  ${document.title}`);
        }
        console.log(`Questions waiting for review: ${counts.questions}`);
        console.log(`Translations waiting for review: ${counts.translations}`);
        console.log(`Flagged because the source changed: ${counts.sourceChanged}`);
        console.log(`Published: ${counts.published}`);
        if (country) {
          // What to hold against the official guide's contents.
          const topics = await getTopicCoverage(pool, country);
          console.log(`By topic (${topics.length}):`);
          for (const topic of topics) {
            const translated =
              topic.translatedInto.length > 0
                ? `, translated into ${topic.translatedInto.join(', ')}`
                : '';
            console.log(
              `  ${topic.name}: ${topic.waiting} waiting, ${topic.published} published${translated}`,
            );
          }
        }
        break;
      }

      default:
        throw new UsageError(`Unknown command "${command}".`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  if (error instanceof UsageError) {
    console.error(`${error.message}\n\nRun "pnpm content help" for usage.`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});
