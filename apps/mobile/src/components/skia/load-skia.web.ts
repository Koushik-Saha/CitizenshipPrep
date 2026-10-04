// The browser build (used for development and automated checks): Skia is a
// WebAssembly module, CanvasKit, that has to be fetched before any Skia code
// runs. canvaskit.wasm is copied into public/ by
// `pnpm --filter @oathly/mobile web:setup`.

let ready: Promise<void> | null = null;

export function loadSkia(): Promise<void> {
  ready ??= import('@shopify/react-native-skia/lib/module/web').then(({ LoadSkiaWeb }) =>
    LoadSkiaWeb({ locateFile: (file) => `/${file}` }),
  );
  return ready;
}
