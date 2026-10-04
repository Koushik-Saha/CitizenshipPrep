import { lazy, Suspense, type ComponentType } from 'react';
import { View } from 'react-native';

import { loadSkia } from './load-skia';

// Skia drawings load lazily. On phones this costs nothing; in the browser
// build Skia's runtime has to arrive first (see load-skia.web.ts), and no
// Skia code may run before it does.

/** Wraps a component that draws with Skia. `placeholder` holds its space until it is ready. */
export function lazySkia<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
  placeholder: (props: P) => { width: number | `${number}%`; height: number },
): ComponentType<P> {
  const Drawing = lazy(async () => {
    await loadSkia();
    return load();
  });
  return function SkiaDrawing(props: P) {
    return (
      <Suspense fallback={<View style={placeholder(props)} />}>
        <Drawing {...props} />
      </Suspense>
    );
  };
}
