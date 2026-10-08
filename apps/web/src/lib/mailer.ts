import {
  MAIL_BATCH,
  mailBatchRequest,
  mailBatchResults,
  parseSender,
  type Mail,
} from '@oathly/api/org-mail';

import { reportError } from './monitoring';

// Outgoing email, through Mailtrap's HTTP API. Used for invitations to an
// organization. Optional: without MAILTRAP_TOKEN and EMAIL_FROM nothing is
// sent, and the admin is given each invitation link to pass on themselves.
//
// With MAILTRAP_INBOX_ID set, mail goes to that Mailtrap sandbox inbox
// instead of to anyone: it can be read there and reaches nobody. That is for
// development, where the addresses typed in are not people expecting mail.

export type { Mail };

const sender = () => parseSender(process.env.EMAIL_FROM);

export function isMailConfigured(): boolean {
  return Boolean(process.env.MAILTRAP_TOKEN && sender());
}

/** Where a batch is posted: the sandbox inbox when one is named, real sending otherwise. */
function endpoint(): string {
  const inbox = process.env.MAILTRAP_INBOX_ID?.trim();
  return inbox && /^\d+$/.test(inbox)
    ? `https://sandbox.api.mailtrap.io/api/batch/${inbox}`
    : 'https://send.api.mailtrap.io/api/batch';
}

/**
 * Sends emails, a batch at a time. Returns, for each, whether it was handed
 * over; never throws. All false when email is not set up.
 */
export async function sendMails(mails: readonly Mail[]): Promise<boolean[]> {
  const from = sender();
  const token = process.env.MAILTRAP_TOKEN;
  const sent: boolean[] = [];
  for (let start = 0; start < mails.length; start += MAIL_BATCH) {
    const batch = mails.slice(start, start + MAIL_BATCH);
    let results = batch.map(() => false);
    if (token && from) {
      try {
        const response = await fetch(endpoint(), {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify(mailBatchRequest(from, batch)),
          signal: AbortSignal.timeout(15_000),
        });
        const body: unknown = await response.json().catch(() => null);
        results = mailBatchResults(body, batch.length);
        if (!response.ok) {
          // The usual cause: EMAIL_FROM is not on a domain verified in Mailtrap.
          reportError(new Error(`Mailtrap refused a batch (${response.status}).`), {
            where: 'mailer',
          });
        }
      } catch (error) {
        reportError(error, { where: 'mailer' });
      }
    }
    sent.push(...results);
  }
  return sent;
}
