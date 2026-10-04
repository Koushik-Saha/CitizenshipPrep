import { PageSkeleton } from '@/components/page-skeleton';

export default function Loading() {
  return <PageSkeleton label="Loading" width="max-w-2xl" blocks={4} />;
}
