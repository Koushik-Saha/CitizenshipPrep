// The terms a learner accepts when they set up their study, and how old they
// have to be.

/** The youngest someone may be to use the service, as the terms say. */
export const MINIMUM_AGE = 16;

/**
 * The date the terms and the privacy policy last changed. What a learner
 * accepts is recorded with this, so it is known which words they agreed to.
 * Change it with every change to their text.
 */
export const TERMS_VERSION = '2026-10-21';

/**
 * Whether a learner still has to confirm their age and accept the terms:
 * they have never done so. Someone who accepted an earlier version is not
 * asked again here; a change that matters is announced in the app, as the
 * terms say.
 */
export function mustAcceptTerms(acceptedAt: string | Date | null | undefined): boolean {
  return !acceptedAt;
}
