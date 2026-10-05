import { T } from '@/components/i18n/provider';
import { PageSkeleton } from '@/components/page-skeleton';

export default function Loading() {
  return <PageSkeleton label={<T k="tutor.opening" />} width="max-w-2xl" blocks={1} />;
}
