'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, ViewTransition } from 'react';

/**
 * Cross-fades between pages.
 *
 * With the View Transitions API: React starts a transition when something
 * inside a <ViewTransition> changes. Wrapping the whole page would make the
 * browser snapshot every pixel of it (the landing page is several screens
 * tall), which costs frames. So the boundary is a 1px marker that changes
 * with the route, and the fade itself runs on the root snapshot, which is
 * only ever the size of the viewport (see ::view-transition-*(root) in
 * globals.css).
 *
 * Without it: Motion fades the new page in. motion/mini (about 3 KB) is only
 * downloaded in those browsers.
 */
export function RouteFade({ children }: { children: React.ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if ('startViewTransition' in document) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = element.current!;
    void import('motion/mini').then(({ animate }) =>
      animate(
        target,
        { opacity: [0.35, 1], transform: ['translateY(4px)', 'translateY(0)'] },
        { duration: 0.16, ease: [0, 0, 0.2, 1] },
      ),
    );
  }, [pathname]);

  return (
    <>
      <div ref={element}>{children}</div>
      <ViewTransition>
        <span
          key={pathname}
          aria-hidden="true"
          className="pointer-events-none fixed top-0 left-0 size-px"
        />
      </ViewTransition>
    </>
  );
}
