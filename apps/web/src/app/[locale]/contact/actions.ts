'use server';

import { supportEmail } from '@oathly/api/support-mail';
import { looksAutomated, parseSupportMessage, type SupportProblem } from '@oathly/core';
import { isUiLocale } from '@oathly/i18n';
import { cookies, headers } from 'next/headers';

import { LOCALE_COOKIE } from '@/lib/locale-cookie';
import { sendMails } from '@/lib/mailer';
import { addressOf, rateLimited } from '@/lib/rate-limit';
import { isSupportFormOpen, supportAddress } from '@/lib/support';
import { currentUser } from '@/lib/user';

export interface ContactState {
  status: 'idle' | 'sent' | 'invalid' | 'wait' | 'failed';
  problems: SupportProblem[];
  /** What was typed, handed back so a problem does not cost the writer their message. */
  values: { name: string; email: string; message: string };
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '');

/**
 * Sends what was written in the contact form to support, and only to
 * support: the writer's address is where a reply goes, never where this mail
 * does, so the form cannot be used to send mail to anyone else.
 */
export async function sendSupportMessage(
  _previous: ContactState,
  form: FormData,
): Promise<ContactState> {
  const input = {
    name: text(form, 'name'),
    email: text(form, 'email'),
    message: text(form, 'message'),
    website: text(form, 'website'),
  };
  const values = { name: input.name, email: input.email, message: input.message };
  const empty = { name: '', email: '', message: '' };
  // A program filled in the field people cannot see: say thanks, send nothing.
  if (looksAutomated(input)) return { status: 'sent', problems: [], values: empty };

  const parsed = parseSupportMessage(input);
  if (!parsed.ok) return { status: 'invalid', problems: parsed.problems, values };

  const to = supportAddress();
  if (!to || !isSupportFormOpen()) return { status: 'failed', problems: [], values };

  const request = new Request('http://contact.invalid', { headers: await headers() });
  // If the count cannot be kept, nothing is sent: this is a way to make us send email.
  if (await rateLimited('supportMessage', 'address', addressOf(request), { failClosed: true })) {
    return { status: 'wait', problems: [], values };
  }

  const locale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const user = await currentUser().catch(() => null);
  const [sent] = await sendMails([
    supportEmail(to, parsed.message, {
      userId: user?.userId,
      locale: locale && isUiLocale(locale) ? locale : null,
    }),
  ]);
  return sent
    ? { status: 'sent', problems: [], values: empty }
    : { status: 'failed', problems: [], values };
}
