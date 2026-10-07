import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describeExam } from '@oathly/api/countries';
import { getTestGuide, listTestPages } from '@oathly/api/server';
import { countryName } from '@oathly/i18n';
import { translatorFor } from '@oathly/i18n/messages';
import { palette } from '@oathly/tokens';
import { ImageResponse } from 'next/og';

import { getDb } from '@/lib/db';
import { loadPublic } from '@/lib/public-content';
import { OG_SIZE } from '@/lib/seo';

// GET /og/<country>.png: the picture a link to a country's test page shows
// when it is shared. One per country, drawn from the same data as the page
// and built with it; publishing content redraws it (lib/revalidate.ts).
//
// The words are English in every language's link: the renderer cannot shape
// Arabic, Bengali or Devanagari, and a card with broken letters is worse than
// one in English. The page's own title and description, which sit under the
// picture, are in the reader's language.
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const pages = await loadPublic((db) => listTestPages(db), []);
  return pages.map((page) => ({ image: `${page.slug}.png` }));
}

const { navy, gold, white } = palette;
const t = translatorFor('en');

const font = (file: string) => readFile(path.join(process.cwd(), 'assets/fonts', file));

const kicker = { fontSize: 56, fontWeight: 600, color: gold[400] };

/** Big for "Canada", smaller for "Saint Vincent and the Grenadines". */
const titleSize = (name: string) => (name.length <= 14 ? 104 : name.length <= 26 ? 84 : 64);

export async function GET(_request: Request, { params }: RouteContext<'/og/[image]'>) {
  const slug = /^([a-z0-9-]{4,80})\.png$/.exec((await params).image)?.[1];
  const guide = slug ? await getTestGuide(getDb(), slug, 'en', 0) : null;
  if (!guide) return new Response('Not found', { status: 404 });

  const country = countryName(guide.isoCode, 'en', guide.name);
  const exam = guide.exams[0];
  const facts = exam ? describeExam(exam, t) : '';
  const [before, after] = t('countries.countryTitle', { country })
    .split(country)
    .map((part) => part.trim());
  const [regular, semibold] = await Promise.all([
    font('Lexend-Regular.ttf'),
    font('Lexend-SemiBold.ttf'),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        backgroundColor: navy[900],
        color: white,
        fontFamily: 'Lexend',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* The mark: a globe whose meridian bends into a check. */}
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <path
            d="M32 4C17 13 11 35 26 50L53 12"
            stroke={gold[400]}
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="32" r="27.5" stroke={white} strokeWidth="9" />
        </svg>
        <div style={{ fontSize: 44, fontWeight: 600 }}>Oathly</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* The page's own heading, with the country's name picked out. */}
        {before && <div style={kicker}>{before}</div>}
        <div style={{ fontSize: titleSize(country), fontWeight: 600, lineHeight: 1.05 }}>
          {country}
        </div>
        {after && <div style={{ ...kicker, marginTop: 8 }}>{after}</div>}
        {exam && (
          <div style={{ fontSize: 30, color: navy[100], marginTop: 28 }}>
            {facts ? `${exam.name}: ${facts}` : exam.name}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', fontSize: 24, color: navy[200] }}>
        {guide.publishedQuestions > 0
          ? `${t('exam.checkedQuestions', { count: guide.publishedQuestions })}. `
          : ''}
        {t('common.notAffiliated')}
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Lexend', data: regular, weight: 400, style: 'normal' },
        { name: 'Lexend', data: semibold, weight: 600, style: 'normal' },
      ],
      // The default is a year, immutable: a redrawn card would never be seen.
      headers: { 'cache-control': 'public, max-age=3600, s-maxage=3600' },
    },
  );
}
