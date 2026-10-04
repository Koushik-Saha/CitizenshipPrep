import { PageSkeleton } from '@/components/page-skeleton';

export default function Loading() {
  return <PageSkeleton label="Opening the tutor" width="max-w-2xl" blocks={1} />;
}
