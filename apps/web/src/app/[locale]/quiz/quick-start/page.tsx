import { localizePath } from '@oathly/i18n';
import { permanentRedirect } from 'next/navigation';

import { getT } from '@/lib/i18n';

// "/quiz/quick-start" was never a page here, but testers and links have
// guessed it as the way in to practice. It goes to the countries, where each
// test's page opens with a round of practice to try without an account.
export default async function QuickStart({ params }: PageProps<'/[locale]/quiz/quick-start'>) {
  const { locale } = await getT(params);
  permanentRedirect(localizePath(locale, '/countries'));
}
