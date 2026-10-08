// Draws the app's icons and splash mark from the Oathly logo, so they are
// never edited by hand: change the drawing or the colours here and run
//
//   pnpm --filter @oathly/mobile brand:assets
//
// The mark is the one on the website (apps/web/src/components/brand/logo.tsx):
// a globe whose meridian bends into a check. Colours are the brand's navy and
// gold from @oathly/tokens. Rendered with the Chromium that Playwright ships.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/images');
mkdirSync(out, { recursive: true });

const NAVY = '#132244';
const GOLD = '#E8B130';
const WHITE = '#FFFFFF';

/** The mark on a 64-unit grid, drawn to fill `share` of a square canvas. */
function mark({ ring, line, share }) {
  const scale = share;
  const offset = (64 - 64 * scale) / 2;
  return `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none">
    <path d="M32 4C17 13 11 35 26 50L53 12" stroke="${line}" stroke-width="7" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="27.5" stroke="${ring}" stroke-width="9"/>
  </g>`;
}

const svg = (body, background) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${
    background ? `<rect width="64" height="64" fill="${background}"/>` : ''
  }${body}</svg>`;

const images = [
  // iOS and the stores: a full square, no transparency; the system rounds it.
  ['icon.png', 1024, svg(mark({ ring: WHITE, line: GOLD, share: 0.62 }), NAVY)],
  // Android adaptive icon: the launcher crops to a shape, so the mark keeps
  // to the middle two thirds of the foreground.
  ['android-icon-foreground.png', 1024, svg(mark({ ring: WHITE, line: GOLD, share: 0.42 }))],
  ['android-icon-background.png', 1024, svg('', NAVY)],
  ['android-icon-monochrome.png', 1024, svg(mark({ ring: WHITE, line: WHITE, share: 0.42 }))],
  // The splash screen shows this on the brand's navy (see app.json).
  ['splash-icon.png', 512, svg(mark({ ring: WHITE, line: GOLD, share: 0.9 }))],
  ['favicon.png', 96, svg(mark({ ring: WHITE, line: GOLD, share: 0.7 }), NAVY)],
];

const browser = await chromium.launch();
for (const [name, size, source] of images) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${source}`,
  );
  await page.screenshot({ path: path.join(out, name), omitBackground: true });
  await page.close();
  console.log(`${name}  ${size}x${size}`);
}
await browser.close();
