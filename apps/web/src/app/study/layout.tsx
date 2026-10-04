import { StudyProviders } from '@/components/study/study-providers';

export default function StudyLayout({ children }: LayoutProps<'/study'>) {
  return <StudyProviders>{children}</StudyProviders>;
}
