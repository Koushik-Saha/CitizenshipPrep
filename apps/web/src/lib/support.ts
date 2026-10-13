import { parseSender } from '@oathly/api/org-mail';

import { operator } from './legal';
import { isMailConfigured } from './mailer';

// Where the contact form sends what people write: SUPPORT_EMAIL, or the
// contact address in the privacy policy when that is not set.

/** The address support reads, or null when none has been set. */
export function supportAddress(): string | null {
  const address = process.env.SUPPORT_EMAIL?.trim() || operator().email;
  return address && parseSender(address) ? parseSender(address)!.email : null;
}

/** Whether the contact form can deliver: there is an address, and email is set up. */
export function isSupportFormOpen(): boolean {
  return supportAddress() !== null && isMailConfigured();
}
