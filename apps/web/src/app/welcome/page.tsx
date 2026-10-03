import { nextStep } from '@oathly/api';
import { redirect } from 'next/navigation';

import { requireMe } from '@/lib/user';

// Where sign-in lands: sends the learner to onboarding or straight to study.
export default async function Welcome() {
  const { me } = await requireMe();
  redirect(nextStep(me) === 'study' ? '/study' : '/onboarding');
}
