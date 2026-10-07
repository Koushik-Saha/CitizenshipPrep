// Outgoing email, through Resend's HTTP API. Used for invitations to an
// organization. Optional: without RESEND_API_KEY and EMAIL_FROM nothing is
// sent, and the admin is given each invitation link to pass on themselves.

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Resend takes this many messages in one request. */
const BATCH = 100;

/**
 * Sends emails, a batch at a time. Returns, for each, whether it was handed
 * over; never throws. All false when email is not set up.
 */
export async function sendMails(mails: readonly Mail[]): Promise<boolean[]> {
  const sent: boolean[] = [];
  for (let start = 0; start < mails.length; start += BATCH) {
    const batch = mails.slice(start, start + BATCH);
    let ok = false;
    if (isMailConfigured()) {
      try {
        const response = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(
            batch.map((mail) => ({
              from: process.env.EMAIL_FROM,
              to: [mail.to],
              subject: mail.subject,
              text: mail.text,
              html: mail.html,
            })),
          ),
          signal: AbortSignal.timeout(15_000),
        });
        ok = response.ok;
      } catch {
        ok = false;
      }
    }
    sent.push(...batch.map(() => ok));
  }
  return sent;
}
