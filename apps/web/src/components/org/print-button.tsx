'use client';

import { buttonClass } from '@/components/ui';

/** Opens the browser's print dialog, where "Save as PDF" is one of the printers. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass.primary}>
      {label}
    </button>
  );
}
