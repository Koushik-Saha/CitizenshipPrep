import { hasOptedOutOfAnalytics } from '@oathly/api/server';

import { I18nProvider } from '@/components/i18n/provider';
import { LegalFooter } from '@/components/site-chrome';
import { StudyProviders } from '@/components/study/study-providers';
import { UsageChoice } from '@/components/study/usage-choice';
import { getDb } from '@/lib/db';
import { clientMessages, getT } from '@/lib/i18n';
import { currentUser } from '@/lib/user';

// What the study screens say. They are Client Components, so their text is
// sent with the page: these groups, in the reader's language only.
const groups = [
  'dashboard',
  'readiness',
  'start',
  'session',
  'results',
  'explain',
  'report',
  'tutor',
  'audio',
  'plans',
] as const;

export default async function StudyLayout({ children, params }: LayoutProps<'/[locale]/study'>) {
  const { locale, t } = await getT(params);
  // Whether this learner has asked not to be counted, for usage recording on
  // this device (the server's own counting asks the database each time).
  const user = await currentUser();
  const usageOff = user
    ? await hasOptedOutOfAnalytics(getDb(), user.userId).catch(() => true)
    : false;
  return (
    <>
      <UsageChoice off={usageOff} />
      <I18nProvider locale={locale} messages={clientMessages(locale, groups)}>
        <StudyProviders>{children}</StudyProviders>
      </I18nProvider>
      <LegalFooter t={t} />
    </>
  );
}
