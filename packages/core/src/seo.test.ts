import { describe, expect, it } from 'vitest';

import {
  breadcrumbSchema,
  faqPageSchema,
  jsonLdScript,
  latestDate,
  passPercent,
  sitemapEntries,
} from './seo';

describe('faqPageSchema', () => {
  it('marks up each question with its answer', () => {
    expect(
      faqPageSchema([
        { question: 'How many questions?', answer: 'Twenty.' },
        { question: 'How long?', answer: '45 minutes.' },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How many questions?',
          acceptedAnswer: { '@type': 'Answer', text: 'Twenty.' },
        },
        {
          '@type': 'Question',
          name: 'How long?',
          acceptedAnswer: { '@type': 'Answer', text: '45 minutes.' },
        },
      ],
    });
  });
});

describe('faqPageSchema and breadcrumbSchema', () => {
  it('leave out the invisible direction marks around embedded names', () => {
    const faq = faqPageSchema([
      { question: 'About \u2068History\u2069?', answer: 'The \u2068Test\u2069 has 20.' },
    ]);
    expect(faq.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: 'About History?',
      acceptedAnswer: { '@type': 'Answer', text: 'The Test has 20.' },
    });
    const crumbs = breadcrumbSchema([
      { name: '\u2068History\u2069', url: 'https://oathly.test/h' },
    ]);
    expect(crumbs.itemListElement[0]!.name).toBe('History');
  });
});

describe('breadcrumbSchema', () => {
  it('numbers the steps from the outside in', () => {
    const schema = breadcrumbSchema([
      { name: 'Countries', url: 'https://oathly.test/countries' },
      { name: 'Canada', url: 'https://oathly.test/canada/citizenship-test' },
    ]);
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Countries',
        item: 'https://oathly.test/countries',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Canada',
        item: 'https://oathly.test/canada/citizenship-test',
      },
    ]);
  });
});

describe('jsonLdScript', () => {
  it('cannot close the script element it is written into', () => {
    const data = { text: '</script><script>alert(1)</script> & more\u2028\u2029' };
    const body = jsonLdScript(data);
    expect(body).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(body)).toEqual(data);
  });
});

describe('passPercent', () => {
  it('is the pass mark as a whole percentage of the questions', () => {
    expect(passPercent(15, 20)).toBe(75);
    expect(passPercent(17, 33)).toBe(52);
    expect(passPercent(12, 20)).toBe(60);
  });

  it('is null when the format does not fix both numbers', () => {
    expect(passPercent(null, 20)).toBeNull();
    expect(passPercent(12, null)).toBeNull();
    expect(passPercent(1, 0)).toBeNull();
  });
});

describe('latestDate', () => {
  it('picks the most recent date, whatever its offset', () => {
    expect(
      latestDate([
        '2026-09-01T00:00:00.000Z',
        null,
        // 11:00 UTC on the 2nd, though it reads as the 3rd.
        '2026-09-03T01:00:00+14:00',
        undefined,
        '2026-09-02T12:00:00.000Z',
        '2026-08-15T00:00:00.000Z',
      ]),
    ).toBe('2026-09-02T12:00:00.000Z');
  });

  it('is null when nothing has been checked', () => {
    expect(latestDate([])).toBeNull();
    expect(latestDate([null, undefined])).toBeNull();
  });
});

describe('sitemapEntries', () => {
  const localize = (locale: string, path: string) =>
    locale === 'en' ? path : path === '/' ? `/${locale}` : `/${locale}${path}`;
  const entries = sitemapEntries(
    [
      { path: '/', lastModified: null },
      { path: '/canada/citizenship-test', lastModified: '2026-09-01T00:00:00.000Z' },
    ],
    { origin: 'https://oathly.test/', locales: ['en', 'es'], defaultLocale: 'en', localize },
  );

  it('lists every page once per language', () => {
    expect(entries.map((entry) => entry.url)).toEqual([
      'https://oathly.test',
      'https://oathly.test/es',
      'https://oathly.test/canada/citizenship-test',
      'https://oathly.test/es/canada/citizenship-test',
    ]);
    expect(entries[2]!.lastModified).toBe('2026-09-01T00:00:00.000Z');
    expect(entries[0]!.lastModified).toBeNull();
  });

  it('names all of a page’s languages on each of them', () => {
    const languages = {
      en: 'https://oathly.test/canada/citizenship-test',
      es: 'https://oathly.test/es/canada/citizenship-test',
      'x-default': 'https://oathly.test/canada/citizenship-test',
    };
    expect(entries[2]!.languages).toEqual(languages);
    expect(entries[3]!.languages).toEqual(languages);
  });
});
