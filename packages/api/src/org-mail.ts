import { textDirection, type Translator } from '@oathly/i18n';

// The email that carries an invitation to an organization. Plain and short:
// who is inviting, what for, one link.

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );

export interface InviteEmailInput {
  organizationName: string;
  /** The name the organization knows the person by, if it gave one. */
  name: string | null;
  role: 'member' | 'admin';
  /** The invitation link. */
  link: string;
  expiresInDays: number;
}

/** The invitation as an email, in the language of `t`. Names are escaped: they come from people. */
export function inviteEmail(
  t: Translator,
  input: InviteEmailInput,
): { subject: string; text: string; html: string } {
  const organization = input.organizationName;
  const lines = [
    input.name ? t('org.emailHelloName', { name: input.name }) : t('org.emailHello'),
    t(input.role === 'admin' ? 'org.emailBodyAdmin' : 'org.emailBody', { organization }),
  ];
  const action = t('org.emailAction');
  const after = [t('org.emailExpires', { days: input.expiresInDays }), t('org.emailFooter')];
  const paragraph = (line: string) => `<p>${escapeHtml(line)}</p>`;
  return {
    // A subject is one line, whatever the organization called itself.
    subject: t('org.emailSubject', { organization }).replace(/[\r\n]+/g, ' '),
    text: [...lines, `${action}: ${input.link}`, ...after].join('\n\n'),
    html: [
      `<div dir="${textDirection(t.locale)}" lang="${t.locale}">`,
      ...lines.map(paragraph),
      `<p><a href="${escapeHtml(input.link)}">${escapeHtml(action)}</a></p>`,
      ...after.map((line) => `<p style="color:#555;font-size:13px">${escapeHtml(line)}</p>`),
      '</div>',
    ].join(''),
  };
}

// Sending it: Mailtrap's batch API, as data in and data out. The request
// itself is made by the web app (lib/mailer.ts).

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Sender {
  email: string;
  name?: string;
}

/**
 * Who email is from, as EMAIL_FROM gives it: "Oathly <invites@example.com>"
 * or a bare address. Null when it is neither.
 */
export function parseSender(value: string | null | undefined): Sender | null {
  const text = value?.trim() ?? '';
  const named = /^(.*)<([^<>\s]+@[^<>\s]+\.[^<>\s]+)>$/.exec(text);
  if (named) {
    const name = named[1]!
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .trim();
    return name ? { email: named[2]!, name } : { email: named[2]! };
  }
  return /^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(text) ? { email: text } : null;
}

/** Mailtrap takes up to 500 messages in one request; a smaller batch fails smaller. */
export const MAIL_BATCH = 100;

/** The body of one batch request: the sender once, then each message. */
export function mailBatchRequest(from: Sender, mails: readonly Mail[]) {
  return {
    base: { from, category: 'Organization invitation' },
    requests: mails.map((mail) => ({
      to: [{ email: mail.to }],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })),
  };
}

/**
 * Which messages of a batch Mailtrap accepted, from its answer. It answers
 * for each message separately, so one bad address does not lose the rest.
 * Anything unreadable counts as nothing sent.
 */
export function mailBatchResults(body: unknown, count: number): boolean[] {
  const responses = (body as { responses?: unknown } | null)?.responses;
  return Array.from({ length: count }, (_, index) => {
    const response = Array.isArray(responses) ? (responses[index] as unknown) : null;
    return (response as { success?: unknown } | null)?.success === true;
  });
}
