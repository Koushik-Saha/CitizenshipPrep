'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Fades each new page in with Motion, in browsers without the View
 * Transitions API (where the root layout's <ViewTransition> does nothing).
 * Motion (motion/mini, about 3 KB) is only downloaded in those browsers.
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
        { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0)'] },
        { duration: 0.2, ease: [0, 0, 0.2, 1] },
      ),
    );
  }, [pathname]);

  return <div ref={element}>{children}</div>;
}
