// On phones Skia is part of the app: there is nothing to load. The browser
// build uses load-skia.web.ts, which Metro picks for the web platform.
export function loadSkia(): Promise<void> {
  return Promise.resolve();
}
