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
