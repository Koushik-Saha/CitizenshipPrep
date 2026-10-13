import type { SupportMessage } from '@oathly/core';

import type { Mail } from './org-mail';

// A message from the website's contact form, as the email support receives.
// Everything in it was typed by a stranger, so the HTML part escapes all of it.

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * The email to support. It is sent to support's own address and to nobody
 * else, with the writer's address as the one to reply to, so answering it is
 * pressing "reply". `context` is what the server knows and the writer did not
 * type: the account they were signed in to, the language they were reading.
 */
export function supportEmail(
  to: string,
  message: SupportMessage,
  context: { userId?: string | null; locale?: string | null } = {},
): Mail {
  const from = message.name ? `${message.name} <${message.email}>` : message.email;
  const facts = [
    `From: ${from}`,
    `Account: ${context.userId ?? 'not signed in'}`,
    ...(context.locale ? [`Language: ${context.locale}`] : []),
  ];
  const firstLine = message.message.split('\n')[0]!.trim();
  const subject = `Support: ${firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine}`;
  return {
    to,
    replyTo: message.email,
    category: 'Support request',
    subject,
    text: `${facts.join('\n')}\n\n${message.message}\n`,
    html: [
      '<div dir="auto">',
      ...facts.map(
        (fact) => `<p style="color:#555;font-size:13px;margin:0">${escapeHtml(fact)}</p>`,
      ),
      `<p style="white-space:pre-wrap">${escapeHtml(message.message)}</p>`,
      '</div>',
    ].join(''),
  };
}
