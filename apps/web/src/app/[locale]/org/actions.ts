'use server';

import { inviteEmail } from '@oathly/api/org-mail';
import type { OrgProblem } from '@oathly/api/org';
import {
  acceptInvite,
  assignLearner,
  createOrganization,
  getOrgAccess,
  getSeats,
  INVITE_DAYS,
  inviteLearners,
  leaveOrganization,
  listExamCountries,
  OrgError,
  removeLogo,
  removeMember,
  renewInvite,
  revokeInvite,
  saveLogo,
  updateOrganization,
  type InviteOutcome,
} from '@oathly/api/server';
import {
  INVITE_LIST_LIMIT,
  isIsoDate,
  isOrgAdmin,
  MAX_LOGO_BYTES,
  parseInviteList,
  type InviteList,
  type InviteListProblem,
} from '@oathly/core';
import { isUiLocale, localizePath, type UiLocale } from '@oathly/i18n';
import { translatorFor } from '@oathly/i18n/messages';
import { parseCountryCode } from '@oathly/api/country-search';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  createOrgPortal,
  createSeatCheckout,
  isSeatBillingConfigured,
  MAX_SEATS_PER_CHECKOUT,
  siteOrigin,
} from '@/lib/billing';
import { getDb } from '@/lib/db';
import { LOCALE_COOKIE } from '@/lib/locale-cookie';
import { isMailConfigured, sendMails } from '@/lib/mailer';
import { currentUser, type SignedInUser } from '@/lib/user';

// What an organization's admins, and the people they invite, can do. Every
// action here is checked again on the server by the function it calls: the
// organization id in a form is only a request, never proof of a role.

async function pageLocale(): Promise<UiLocale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  return chosen && isUiLocale(chosen) ? chosen : 'en';
}

async function signedIn(locale: UiLocale): Promise<SignedInUser> {
  const user = await currentUser();
  if (!user) redirect(localizePath(locale, '/sign-in'));
  return user;
}

const field = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
const dateField = (form: FormData, name: string) => {
  const value = field(form, name);
  return value && isIsoDate(value) ? value : null;
};

/** The organization a form names, with the caller's role in it; off to the list if there is none. */
async function organizationOf(form: FormData, user: SignedInUser, locale: UiLocale) {
  const access = await getOrgAccess(getDb(), user.userId, { id: field(form, 'organizationId') });
  if (!access) redirect(localizePath(locale, '/org'));
  return access;
}

/** Runs something that may be refused, and goes back to `path` saying why if it is. */
async function attempt(path: string, work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (error) {
    if (error instanceof OrgError) redirect(`${path}?error=${error.problem}`);
    throw error;
  }
}

export async function createOrg(form: FormData): Promise<void> {
  const locale = await pageLocale();
  const user = await signedIn(locale);
  let slug = '';
  await attempt(localizePath(locale, '/org'), async () => {
    slug = (
      await createOrganization(getDb(), user.userId, {
        name: field(form, 'name'),
        kind: field(form, 'kind'),
        email: user.email,
      })
    ).slug;
  });
  redirect(localizePath(locale, `/org/${slug}/invite`));
}

export async function saveDetails(form: FormData): Promise<void> {
  const locale = await pageLocale();
  const user = await signedIn(locale);
  const { organization } = await organizationOf(form, user, locale);
  const settings = localizePath(locale, `/org/${organization.slug}/settings`);
  await attempt(settings, async () => {
    await updateOrganization(getDb(), user.userId, organization.id, {
      name: field(form, 'name'),
      kind: field(form, 'kind'),
      brandColor: field(form, 'brandColor') || null,
      brandAccent: field(form, 'brandAccent') || null,
    });
    const logo = form.get('logo');
    if (logo instanceof File && logo.size > 0) {
      // Refuse an oversized file before reading it into memory.
      if (logo.size > MAX_LOGO_BYTES) throw new OrgError('bad-logo');
      await saveLogo(
        getDb(),
        user.userId,
        organization.id,
        new Uint8Array(await logo.arrayBuffer()),
      );
    }
  });
  redirect(`${settings}?saved=1`);
}

export async function deleteLogo(form: FormData): Promise<void> {
  const locale = await pageLocale();
  const user = await signedIn(locale);
  const { organization } = await organizationOf(form, user, locale);
  const settings = localizePath(locale, `/org/${organization.slug}/settings`);
  await attempt(settings, () => removeLogo(getDb(), user.userId, organization.id));
  redirect(`${settings}?saved=1`);
}

// Inviting ------------------------------------------------------------------------

/** What the invitation form shows after it is sent. */
export interface InviteState {
  done: boolean;
  error: OrgProblem | 'nothing' | null;
  /** Invitations that went out by email. */
  emailed: number;
  /** Invitations to pass on by hand: email is not set up, or did not go. */
  links: { email: string; url: string }[];
  alreadyMembers: string[];
  noSeats: string[];
  problems: InviteListProblem[];
  overLimit: number;
}

const emptyInvite: InviteState = {
  done: false,
  error: null,
  emailed: 0,
  links: [],
  alreadyMembers: [],
  noSeats: [],
  problems: [],
  overLimit: 0,
};

/** Emails each invitation, and returns the ones that have to be passed on by hand. */
async function deliver(
  outcome: InviteOutcome,
  input: { organizationName: string; role: 'member' | 'admin'; locale: UiLocale },
): Promise<{ emailed: number; links: { email: string; url: string }[] }> {
  const origin = await siteOrigin();
  const t = translatorFor(input.locale);
  const invitations = outcome.invited.map((invite) => ({
    ...invite,
    url: `${origin}${localizePath(input.locale, `/join/${invite.token}`)}`,
  }));
  const sent = isMailConfigured()
    ? await sendMails(
        invitations.map((invite) => ({
          to: invite.email,
          ...inviteEmail(t, {
            organizationName: input.organizationName,
            name: invite.name,
            role: input.role,
            link: invite.url,
            expiresInDays: INVITE_DAYS,
          }),
        })),
      )
    : invitations.map(() => false);
  return {
    emailed: sent.filter(Boolean).length,
    links: invitations.filter((_, index) => !sent[index]).map(({ email, url }) => ({ email, url })),
  };
}

/** The most CSV a list may be: far more than 500 lines need. */
const MAX_LIST_BYTES = 1024 * 1024;

export async function sendInvites(_previous: InviteState, form: FormData): Promise<InviteState> {
  const locale = await pageLocale();
  const user = await signedIn(locale);
  const { organization, role: myRole } = await organizationOf(form, user, locale);
  if (!isOrgAdmin(myRole)) return { ...emptyInvite, done: true, error: 'forbidden' };

  const role = field(form, 'role') === 'admin' ? 'admin' : 'member';
  const options = {
    countries: await listExamCountries(getDb()),
    defaultCountry: parseCountryCode(form.get('countryCode')),
    defaultTargetDate: dateField(form, 'targetDate'),
    today: new Date().toISOString().slice(0, 10),
  };
  const file = form.get('file');
  const sources = [
    field(form, 'emails'),
    file instanceof File && file.size > 0 && file.size <= MAX_LIST_BYTES ? await file.text() : '',
  ].filter(Boolean);
  // Typed addresses and an uploaded file are read as two lists, then joined.
  const list: InviteList = { rows: [], problems: [], overLimit: 0 };
  for (const source of sources) {
    const parsed = parseInviteList(source, {
      ...options,
      limit: INVITE_LIST_LIMIT - list.rows.length,
    });
    const known = new Set(list.rows.map((row) => row.email));
    list.rows.push(...parsed.rows.filter((row) => !known.has(row.email)));
    list.problems.push(...parsed.problems);
    list.overLimit += parsed.overLimit;
  }
  const state = { ...emptyInvite, done: true, problems: list.problems, overLimit: list.overLimit };
  if (list.rows.length === 0) return { ...state, error: list.problems.length ? null : 'nothing' };

  try {
    const outcome = await inviteLearners(getDb(), user.userId, organization.id, list.rows, {
      role,
    });
    // The page around the form shows the seats and the invitations now out.
    revalidatePath('/[locale]/org/[slug]/invite', 'page');
    return {
      ...state,
      ...(await deliver(outcome, { organizationName: organization.name, role, locale })),
      alreadyMembers: outcome.alreadyMembers,
      noSeats: outcome.noSeats,
    };
  } catch (error) {
    if (error instanceof OrgError) return { ...state, error: error.problem };
    throw error;
  }
}

/** What "send again" shows: sent, or the new link to pass on. */
export interface ResendState {
  done: boolean;
  error: OrgProblem | 'no-seats' | null;
  emailed: boolean;
  url: string | null;
}

export async function resendInvite(_previous: ResendState, form: FormData): Promise<ResendState> {
  const locale = await pageLocale();
  const user = await signedIn(locale);
  const { organization } = await organizationOf(form, user, locale);
  const state: ResendState = { done: true, error: null, emailed: false, url: null };
  try {
    const outcome = await renewInvite(
      getDb(),
      user.userId,
      organization.id,
      field(form, 'inviteId'),
    );
    if (outcome.invited.length === 0) return { ...state, error: 'no-seats' };
    revalidatePath('/[locale]/org/[slug]/invite', 'page');
    const role = field(form, 'role') === 'admin' ? 'admin' : 'member';
    const delivered = await deliver(outcome, { organizationName: organization.name, role, locale });
    return { ...state, emailed: delivered.emailed > 0, url: delivered.links[0]?.url ?? null };
  } catch (error) {
    if (error instanceof OrgError) return { ...state, error: error.problem };
    throw error;
  }
}

export async function withdrawInvite(form: FormData): Promise<void> {
  const locale = await pageLocale();
  const user = await signedIn(locale);
  const { organization } = await organizationOf(form, user, locale);
  const page = localizePath(locale, `/org/${organization.slug}/invite`);
  await attempt(page, () =>
    revokeInvite(getDb(), user.userId, organization.id, field(form, 'inviteId')),
  );
  redirect(page);
}

// Members -------------------------------------------------------------------------

export async function assign(form: FormData): Promise<void> {
  const locale = await pageLocale();
  const user = await signedIn(locale);
  const { organization } = await organizationOf(form, user, locale);
  const page = localizePath(locale, `/org/${organization.slug}`);
  await attempt(page, () =>
    assignLearner(getDb(), user.userId, organization.id, field(form, 'userId'), {
      countryCode: parseCountryCode(form.get('countryCode')),
      targetDate: dateField(form, 'targetDate'),
    }),
  );
  redirect(page);
}

export async function remove(form: FormData): Promise<void> {
  const locale = await pageLocale();
  const user = await signedIn(locale);
  const { organization } = await organizationOf(form, user, locale);
  // Back to the page the button was on: one of two, never a path from the form.
  const section = field(form, 'from') === '/settings' ? '/settings' : '';
  const page = localizePath(locale, `/org/${organization.slug}${section}`);
  await attempt(page, () =>
    removeMember(getDb(), user.userId, organization.id, field(form, 'userId')),
  );
  redirect(page);
}

export async function leave(form: FormData): Promise<void> {
  const locale = await pageLocale();
  const user = await signedIn(locale);
  await leaveOrganization(getDb(), user.userId, field(form, 'organizationId'));
  redirect(localizePath(locale, '/org'));
}

// Seats ---------------------------------------------------------------------------

export async function buySeats(form: FormData): Promise<void> {
  const locale = await pageLocale();
  const user = await signedIn(locale);
  const { organization, role, granted } = await organizationOf(form, user, locale);
  const settings = localizePath(locale, `/org/${organization.slug}/settings`);
  if (!isOrgAdmin(role)) redirect(`${settings}?error=forbidden`);
  if (!isSeatBillingConfigured()) redirect(settings);
  const returnUrl = `${await siteOrigin()}${settings}`;

  // One subscription per organization: more seats are added to it, in the portal.
  const seats = await getSeats(getDb(), organization.id, granted);
  if (seats.subscription?.inForce) {
    redirect((await createOrgPortal(organization.id, returnUrl)) ?? settings);
  }
  const wanted = Number.parseInt(field(form, 'seats'), 10);
  if (!Number.isInteger(wanted) || wanted < 1 || wanted > MAX_SEATS_PER_CHECKOUT) {
    redirect(`${settings}?error=invalid`);
  }
  redirect(await createSeatCheckout({ user, organization, seats: wanted, locale, returnUrl }));
}

export async function openOrgPortal(form: FormData): Promise<void> {
  const locale = await pageLocale();
  const user = await signedIn(locale);
  const { organization, role } = await organizationOf(form, user, locale);
  const settings = localizePath(locale, `/org/${organization.slug}/settings`);
  if (!isOrgAdmin(role)) redirect(`${settings}?error=forbidden`);
  if (!isSeatBillingConfigured()) redirect(settings);
  redirect(
    (await createOrgPortal(organization.id, `${await siteOrigin()}${settings}`)) ?? settings,
  );
}

// Joining -------------------------------------------------------------------------

/** Accepts an invitation, by its link's token or (from the dashboard) by its id. */
export async function join(form: FormData): Promise<void> {
  const locale = await pageLocale();
  const token = field(form, 'token');
  const inviteId = field(form, 'inviteId');
  const user = await currentUser();
  if (!user) {
    redirect(
      localizePath(locale, token ? `/sign-in?join=${encodeURIComponent(token)}` : '/sign-in'),
    );
  }
  const back = localizePath(locale, token ? `/join/${token}` : '/study');
  let next = back;
  await attempt(back, async () => {
    const joined = await acceptInvite(getDb(), user, token ? { token } : { inviteId });
    const { slug } = joined.organization;
    if (isOrgAdmin(joined.role)) next = `/org/${slug}`;
    else if (!joined.onStudyPlan) {
      // New to Oathly: set up, with the organization's country and date filled in.
      next = `/onboarding?country=${joined.countryCode}${joined.targetDate ? `&date=${joined.targetDate}` : ''}`;
    } else next = `/welcome?joined=${slug}`;
    next = localizePath(locale, next);
  });
  redirect(next);
}
