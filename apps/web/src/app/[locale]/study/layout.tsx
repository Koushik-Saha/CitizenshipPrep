import { I18nProvider } from '@/components/i18n/provider';
import { StudyProviders } from '@/components/study/study-providers';
import { clientMessages, getT } from '@/lib/i18n';

// What the study screens say. They are Client Components, so their text is
// sent with the page: these groups, in the reader's language only.
const groups = [
  'dashboard',
  'readiness',
  'start',
  'session',
  'results',
  'explain',
  'tutor',
] as const;

export default async function StudyLayout({ children, params }: LayoutProps<'/[locale]/study'>) {
  const { locale } = await getT(params);
  return (
    <I18nProvider locale={locale} messages={clientMessages(locale, groups)}>
      <StudyProviders>{children}</StudyProviders>
    </I18nProvider>
  );
}
