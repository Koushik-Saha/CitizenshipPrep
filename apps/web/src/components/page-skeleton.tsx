// The instant state of a signed-in page: links prefetch it, so a click shows
// this at once while the learner's data arrives. Server Component.

export function PageSkeleton({
  label,
  width = 'max-w-4xl',
  blocks = 3,
}: {
  /** What is loading, for screen readers. */
  label: string;
  width?: 'max-w-2xl' | 'max-w-3xl' | 'max-w-4xl';
  blocks?: number;
}) {
  return (
    <main className={`mx-auto ${width} px-4 py-10 sm:py-14`} aria-busy="true">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="bg-surface-sunken h-10 w-64 max-w-full rounded-md" />
        <div className="bg-surface-sunken mt-4 h-5 w-96 max-w-full rounded-md" />
        <div className="mt-8 space-y-4">
          {Array.from({ length: blocks }, (_, i) => (
            <div key={i} className="bg-surface border-border h-28 rounded-lg border" />
          ))}
        </div>
      </div>
    </main>
  );
}
