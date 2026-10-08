import { ApiError } from '@oathly/api/client';
import { storeSubscriptionsToCancel } from '@oathly/core';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import {
  Body,
  Button,
  Heading,
  LinkButton,
  LoadingScreen,
  Message,
  Screen,
  useTheme,
} from '@/components/ui';
import { api, deleteSignInAccount } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { backToStudy } from '@/lib/navigation';
import { forgetEverything } from '@/lib/offline';
import { useSession } from '@/lib/session';

const blockedMessage = {
  organization: 'profile.deleteBlockedOrganization',
  staff: 'profile.deleteBlockedStaff',
} as const;

// Deleting the account, from inside the app: what goes, what the learner has
// to cancel themselves first, a tick that it is understood, and the button.
export default function DeleteAccount() {
  const t = useT();
  const theme = useTheme();
  const session = useSession();
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (session.status === 'loading') return <LoadingScreen label={t('common.loading')} />;
  if (session.status !== 'signed-in') return <Redirect href="/" />;

  // What renews until cancelled: everything in force but a one-off pass.
  const renewing = session.me.entitlements
    .filter(
      (held) => held.status !== 'expired' && held.status !== 'canceled' && !held.cancelAtPeriodEnd,
    )
    .map((held) => ({
      provider: held.provider,
      plan: held.plan,
      renews: held.plan !== 'country_pass',
    }));
  const inStores = storeSubscriptionsToCancel(renewing).length > 0;
  const onWeb = renewing.some((held) => held.provider === 'stripe' && held.renews);

  async function remove() {
    setBusy(true);
    setProblem(null);
    try {
      await api.deleteAccount();
    } catch (error) {
      const reason = error instanceof ApiError ? error.reason : undefined;
      const key = blockedMessage[reason as keyof typeof blockedMessage];
      setProblem(t(key ?? 'profile.deleteFailed'));
      setBusy(false);
      return;
    }
    // Gone from Oathly. Now the sign-in account, what this phone has saved,
    // and the session itself.
    await deleteSignInAccount();
    await forgetEverything();
    await session.signOut();
    router.replace('/');
  }

  return (
    <Screen>
      <Heading>{t('profile.deleteTitle')}</Heading>
      <Body>{t('profile.deleteIntro')}</Body>
      {onWeb && <Body>{t('profile.deleteStripe')}</Body>}
      {inStores && <Message tone="error">{t('profile.deleteStores')}</Message>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
        <Switch
          value={understood}
          onValueChange={setUnderstood}
          accessibilityLabel={t('profile.deleteConfirm')}
          trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
          testID="delete-understood"
        />
        <View style={{ flex: 1 }}>
          <Body>{t('profile.deleteConfirm')}</Body>
        </View>
      </View>
      {problem && <Message tone="error">{problem}</Message>}
      <View style={{ gap: theme.spacing[3] }}>
        <Button
          label={t('profile.deleteButton')}
          onPress={() => void remove()}
          disabled={!understood}
          busy={busy}
          testID="delete-account"
        />
        <LinkButton label={t('common.backToStudy')} onPress={backToStudy} testID="delete-back" />
      </View>
    </Screen>
  );
}
