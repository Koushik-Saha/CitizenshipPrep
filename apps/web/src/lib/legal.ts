// Who runs Oathly, for the privacy policy and the terms. Set on the host
// before going live: a policy has to say who is responsible and how to reach
// them. The pages are built ahead of time, so these are read at build time.

export interface Operator {
  /** The person or company responsible for the service. */
  name: string;
  /** Where privacy requests and questions go. Null until it is set. */
  email: string | null;
  /** A postal address, where the law asks for one. */
  address: string | null;
  /** Whose law governs the terms, e.g. "England and Wales". */
  jurisdiction: string | null;
}

const value = (name: string) => process.env[name]?.trim() || null;

export function operator(): Operator {
  return {
    name: value('LEGAL_OPERATOR') ?? 'Oathly',
    email: value('LEGAL_CONTACT_EMAIL'),
    address: value('LEGAL_ADDRESS'),
    jurisdiction: value('LEGAL_JURISDICTION'),
  };
}

/** When the privacy policy and terms last changed. Update with every change to their text. */
export const LEGAL_UPDATED = '2026-10-08';
