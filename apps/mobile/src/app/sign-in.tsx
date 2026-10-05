import { looksLikeEmail, normalizeCode } from '@oathly/api';
import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Field, Heading, Message, Screen } from '@/components/ui';
import { sendSignInCode, verifySignInCode } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';

export default function SignIn() {
  const session = useSession();
  const t = useT();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    if (!looksLikeEmail(email)) {
      setError(t('auth.emailRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    const problem = await sendSignInCode(email.trim());
    setBusy(false);
    if (problem) setError(problem);
    else setStep('code');
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const problem = await verifySignInCode(email.trim(), code);
    if (problem) {
      setBusy(false);
      setError(problem);
      return;
    }
    await session.refresh();
    setBusy(false);
    router.replace('/');
  }

  return (
    <Screen>
      <Heading>{t('auth.title')}</Heading>
      {step === 'email' ? (
        <>
          <Body muted>{t('auth.introMobile')}</Body>
          {error && <Message tone="error">{error}</Message>}
          <Field
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void sendCode()}
          />
          <Button label={t('auth.sendCode')} onPress={() => void sendCode()} busy={busy} />
        </>
      ) : (
        <>
          <Body muted>{t('auth.codeSent', { email: email.trim() })}</Body>
          {error && <Message tone="error">{error}</Message>}
          <Field
            label={t('auth.code')}
            value={code}
            onChangeText={(value) => setCode(normalizeCode(value))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={7}
            returnKeyType="done"
            onSubmitEditing={() => void verify()}
          />
          <Button
            label={t('auth.verifyCode')}
            onPress={() => void verify()}
            busy={busy}
            disabled={code.length !== 6}
          />
          <Button
            label={t('auth.differentEmail')}
            variant="secondary"
            onPress={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          />
        </>
      )}
      <Body muted>{t('common.notAffiliated')}</Body>
    </Screen>
  );
}
