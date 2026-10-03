import { looksLikeEmail, normalizeCode } from '@oathly/api';
import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Field, Heading, Message, Screen } from '@/components/ui';
import { sendSignInCode, verifySignInCode } from '@/lib/auth';
import { useSession } from '@/lib/session';

export default function SignIn() {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    if (!looksLikeEmail(email)) {
      setError('Enter your email address.');
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
      <Heading>Sign in to Oathly</Heading>
      {step === 'email' ? (
        <>
          <Body muted>
            New here? Signing in creates your account. Use the same email as on the web and your
            progress follows you.
          </Body>
          {error && <Message tone="error">{error}</Message>}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void sendCode()}
          />
          <Button label="Email me a code" onPress={() => void sendCode()} busy={busy} />
        </>
      ) : (
        <>
          <Body muted>We sent a 6-digit code to {email.trim()}. It expires in a few minutes.</Body>
          {error && <Message tone="error">{error}</Message>}
          <Field
            label="Code"
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
            label="Sign in"
            onPress={() => void verify()}
            busy={busy}
            disabled={code.length !== 6}
          />
          <Button
            label="Use a different email"
            variant="secondary"
            onPress={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          />
        </>
      )}
      <Body muted>
        Oathly is an independent study app. It is not affiliated with any government.
      </Body>
    </Screen>
  );
}
