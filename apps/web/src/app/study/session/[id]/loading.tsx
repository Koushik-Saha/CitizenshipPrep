import { PageSkeleton } from '@/components/page-skeleton';

export default function Loading() {
  return <PageSkeleton label="Loading your session" width="max-w-2xl" blocks={2} />;
}
