// A message to support from the website's contact form: what it has to hold
// to be sent on.

export const SUPPORT_NAME_MAX = 100;
export const SUPPORT_MESSAGE_MAX = 4000;

export interface SupportMessage {
  name: string;
  /** Where the reply goes. */
  email: string;
  message: string;
}

export type SupportProblem = 'email' | 'message';

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

/**
 * A contact form as it arrives, checked. Returns the message, or what is
 * wrong with it. Line breaks and control characters are taken out of the name
 * and the address: they go into an email's headers.
 */
export function parseSupportMessage(
  input: Record<string, unknown>,
): { ok: true; message: SupportMessage } | { ok: false; problems: SupportProblem[] } {
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const oneLine = (value: unknown) =>
    text(value)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .trim();
  const name = oneLine(input.name).slice(0, SUPPORT_NAME_MAX);
  const email = oneLine(input.email);
  const message = text(input.message).trim().slice(0, SUPPORT_MESSAGE_MAX);

  const problems: SupportProblem[] = [];
  if (email.length > 254 || !EMAIL.test(email)) problems.push('email');
  if (message.length < 10) problems.push('message');
  return problems.length > 0
    ? { ok: false, problems }
    : { ok: true, message: { name, email, message } };
}

/**
 * Whether a form was filled in by a program rather than a person: the form
 * has a field people cannot see, and only a program types in it.
 */
export function looksAutomated(input: Record<string, unknown>): boolean {
  return typeof input.website === 'string' && input.website.trim() !== '';
}
