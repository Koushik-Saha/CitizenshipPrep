import { T } from '@/components/i18n/provider';
import { PageSkeleton } from '@/components/page-skeleton';

export default function Loading() {
  return <PageSkeleton label={<T k="common.loading" />} width="max-w-3xl" blocks={3} />;
}
