import Link from 'next/link';

// An admin address that leads nowhere: a question or a user that does not
// exist, or has gone.
export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="font-display text-3xl font-semibold">Not found</h1>
      <p className="text-fg-muted mt-4">
        There is nothing at this address. It may have been removed, or the link may be wrong.
      </p>
      <p className="mt-8">
        <Link
          href="/admin/content"
          className="text-primary-fg font-medium underline underline-offset-4"
        >
          Back to the review queue
        </Link>
      </p>
    </div>
  );
}
