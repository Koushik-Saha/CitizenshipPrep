import { Linking, View } from 'react-native';

import { LinkButton, useTheme } from '@/components/ui';
import { apiUrl } from '@/lib/env';
import { useT } from '@/lib/i18n';

const pages = [
  ['common.terms', '/terms'],
  ['common.privacy', '/privacy'],
  ['common.refunds', '/refunds'],
  ['common.contact', '/contact'],
] as const;

/**
 * The terms, the privacy policy, the refund policy and how to reach support,
 * each opened on the website. Shown wherever someone signs in, pays, or
 * manages their account: both app stores require the first two to be
 * reachable from inside an app that sells subscriptions.
 */
export function LegalLinks() {
  const t = useT();
  const theme = useTheme();
  const site = apiUrl.replace(/\/+$/, '');
  return (
    <View
      accessibilityRole="list"
      style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: theme.spacing[4] }}
    >
      {pages.map(([label, path]) => (
        <LinkButton
          key={path}
          label={t(label)}
          onPress={() => void Linking.openURL(`${site}${path}`)}
          testID={`legal-${path.slice(1)}`}
        />
      ))}
    </View>
  );
}
