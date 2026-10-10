// Study groups: the rules for what may be posted and what is held back.
//
// Every post and comment is screened before anyone else can read it. What is
// held stays hidden until a moderator has looked. The community is for
// studying: a post asking about the writer's own immigration case is always
// held, and is shown with a notice to see a licensed attorney.

export const postKinds = ['discussion', 'tip', 'story'] as const;
export type PostKind = (typeof postKinds)[number];

export const reportReasons = ['spam', 'abuse', 'legal_advice', 'off_topic', 'other'] as const;
export type ReportReason = (typeof reportReasons)[number];

/** Why something is hidden. "removed" is a moderator's decision; the rest await one. */
export const holdReasons = [
  'toxicity',
  'spam',
  'legal_advice',
  'personal_data',
  'unscreened',
  'reports',
  'removed',
] as const;
export type HoldReason = (typeof holdReasons)[number];

export const POST_TITLE_MAX = 200;
export const POST_BODY_MAX = 5000;
export const COMMENT_MAX = 2000;
/** This many learners reporting a post hides it until a moderator has looked. */
export const REPORTS_TO_HIDE = 3;

// Someone writing about themselves, a matter an attorney handles, and a
// request for a verdict on it. All three together read as "what should I do
// about my case"; any one alone is ordinary talk about the exam.
const ABOUT_ME =
  /\b(i|i'm|i've|im|me|my|mine|we|our|my (?:husband|wife|spouse|partner|son|daughter|mother|father|parents?|brother|sister|child|kids?))\b/;
const LEGAL_MATTER =
  /\b(visa (?:was |got |is |has been )?(?:denied|refused|rejected|revoked|expired|cancell?ed)|(?:denied|refused|rejected) (?:my |the |a )?(?:visa|application|petition|green card|citizenship)|overstay(?:ed|ing)?|deport(?:ed|ation)?|removal (?:order|proceedings)|criminal record|arrest(?:ed)?|convict(?:ed|ion)|felony|misdemeanou?r|dui|asylum|undocumented|out of status|unlawful presence|immigration (?:court|judge|case|status|hold)|inadmissib\w*|misrepresent\w*|waiver|appeal(?:ed|ing)?|lawyer|attorney|solicitor)\b/;
const ASKS_FOR_A_VERDICT =
  /\b(can i|could i|should i|will i|would i|am i|do i|may i|can we|should we|will they|is it possible|what (?:should|can|do) (?:i|we)|what happens|eligible|qualify|still apply|allowed to|any chance|risk)\b|\?/;
const MY_CASE = /\bmy (?:immigration |citizenship |visa |asylum |court )?case\b/;

/**
 * Whether a text asks for help with the writer's own legal situation. Rules
 * only, and in English only: the model's screening covers the rest. It errs
 * towards holding, because a held post costs a short wait and unqualified
 * advice on someone's status can cost them much more.
 */
export function asksForLegalAdvice(text: string): boolean {
  const plain = text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
  if (MY_CASE.test(plain)) return true;
  return ABOUT_ME.test(plain) && LEGAL_MATTER.test(plain) && ASKS_FOR_A_VERDICT.test(plain);
}

const SPAM_PHRASES =
  /\b(buy now|click here|limited offer|earn \$?\d|make money|guaranteed pass|pass guaranteed|real (?:passport|licen[cs]e|certificate) for sale|whatsapp \+?\d|telegram @|crypto|casino|loan approval)\b/;

/** The plainest advertising: several links, a wall of one character, or a sales phrase. */
export function looksLikeSpam(text: string): boolean {
  const plain = text.toLowerCase();
  const links = plain.match(/https?:\/\/|www\./g)?.length ?? 0;
  return links >= 3 || /(.)\1{14,}/.test(plain) || SPAM_PHRASES.test(plain);
}

const EMAIL_ADDRESS = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
// Nine or more digits close together: a phone number, not a year or a score.
const PHONE_NUMBER = /(?:\+?\d[\s().-]{0,2}){9,15}/;
// Numbers an immigration office gives a person or a case: a US A-Number
// ("A123456789"), a US receipt number ("IOE0912345678"), and anything written
// after "case number", "receipt number", "file number" or "reference number".
const IMMIGRATION_NUMBER =
  /\bA[-\s]?\d{8,9}\b|\b(?:EAC|WAC|LIN|SRC|NBC|MSC|IOE|YSC)\d{10}\b|\b(?:case|receipt|file|reference|application|alien|registration)\s*(?:number|no\.?|#)\s*:?\s*[A-Z0-9-]{6,}/i;

/**
 * Whether a text carries something that identifies a person or their case: an
 * email address, a phone number, or an immigration case number. A study group
 * is read by strangers, and these are what a learner later wishes they had not
 * posted, about themselves or about someone else.
 */
export function mentionsPersonalData(text: string): boolean {
  return EMAIL_ADDRESS.test(text) || PHONE_NUMBER.test(text) || IMMIGRATION_NUMBER.test(text);
}

/**
 * A text as it is handed to the model for screening, between <post> tags. A
 * tag written inside the text is taken apart, so the writer cannot end the
 * post early and add words of their own after it.
 */
export function screeningInput(text: string): string {
  return `<post>\n${text.slice(0, 6000).replace(/<\s*(\/?)\s*post\s*>/gi, '[$1post]')}\n</post>`;
}

/** What the model found in a text. */
export interface ScreeningVerdict {
  toxicity: boolean;
  spam: boolean;
  legalAdvice: boolean;
  /** Details that identify a person or their case. */
  personalData: boolean;
}

/**
 * The model's reply as a verdict, or null if it is not one. The reply is
 * asked for as a small JSON object; anything else is not trusted.
 */
export function parseScreening(reply: string): ScreeningVerdict | null {
  const json = /\{[^{}]*\}/.exec(reply)?.[0];
  if (!json) return null;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  const record = value as Record<string, unknown>;
  const { toxicity, spam, legal_advice: legalAdvice } = record;
  if (
    typeof toxicity !== 'boolean' ||
    typeof spam !== 'boolean' ||
    typeof legalAdvice !== 'boolean'
  ) {
    return null;
  }
  // Asked for with the rest; a reply without it is read as "none found", and
  // the patterns above still apply.
  return { toxicity, spam, legalAdvice, personalData: record.personal_data === true };
}

export interface Screening {
  /** Empty when the text can be shown straight away. */
  heldFor: HoldReason[];
  /** Show the "talk to a licensed attorney" notice with it. */
  legalNotice: boolean;
}

/**
 * Whether a text is held, from the rules above and the model's verdict.
 * `model` is null when the model was asked and did not give a usable answer:
 * the text then waits for a moderator rather than going out unscreened. It is
 * "none" on a server with no model at all, where the rules decide alone.
 */
export function screen(text: string, model: ScreeningVerdict | null | 'none'): Screening {
  const verdict = model === 'none' ? null : model;
  const legalNotice = asksForLegalAdvice(text) || verdict?.legalAdvice === true;
  const heldFor: HoldReason[] = [];
  if (verdict?.toxicity) heldFor.push('toxicity');
  if (verdict?.spam || looksLikeSpam(text)) heldFor.push('spam');
  if (legalNotice) heldFor.push('legal_advice');
  if (verdict?.personalData || mentionsPersonalData(text)) heldFor.push('personal_data');
  if (model === null) heldFor.push('unscreened');
  return { heldFor, legalNotice };
}

/** Whether enough learners have reported something for it to be hidden until reviewed. */
export function hiddenByReports(openReports: number): boolean {
  return openReports >= REPORTS_TO_HIDE;
}

/** A story's exam date is in the past (or today) and within living memory of the exam. */
export function isPlausibleExamDate(date: string, today: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const now = today.toISOString().slice(0, 10);
  const earliest = `${today.getUTCFullYear() - 10}${now.slice(4)}`;
  return date <= now && date >= earliest;
}
