import type { MetadataRoute } from 'next';

// The site as an app a phone or computer can install (/manifest.webmanifest;
// Next links it from every page). Opening it goes to the learner's study
// page, which asks a signed-out visitor to sign in first. The icons are drawn
// by apps/mobile/scripts/brand-assets.mjs, in the brand's navy.
const NAVY = '#132244';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Oathly: citizenship test practice',
    short_name: 'Oathly',
    description:
      'Practice for your citizenship test with questions checked against official sources. Independent, not a government service.',
    start_url: '/study',
    scope: '/',
    display: 'standalone',
    background_color: NAVY,
    theme_color: NAVY,
    categories: ['education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
